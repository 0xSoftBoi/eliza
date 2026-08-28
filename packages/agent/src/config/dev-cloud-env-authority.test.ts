import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyDevCloudConfigAuthority,
  captureDevCloudEnvAuthority,
  createDevCloudConfigAuthorityView,
  createDevCloudRuntimeSettingsAuthorityOverlay,
  isDevCloudConfigAuthorityView,
  isDevCloudEnvOwnedKey,
  isDevCloudInternalEnvKey,
  materializeDevCloudConfigAuthorityView,
  mergeDevCloudConfigAuthorityMutation,
  resetDevCloudEnvAuthorityForTests,
  restoreDevCloudEnvAuthority,
} from "./dev-cloud-env-authority.ts";

const SAVED_ENV = { ...process.env };

function authorityEnv(
  authority: "staging-default" | "staging-explicit" | "self-hosted" | "offline" =
    "staging-default",
): NodeJS.ProcessEnv {
  return {
    ELIZA_DEV_SOURCE: "1",
    ELIZA_DEV_CLOUD_ENV_AUTHORITY: authority,
    ELIZA_DEV_CLOUD_TARGET: authority === "offline" ? "offline" : "staging",
  };
}

beforeEach(() => {
  resetDevCloudEnvAuthorityForTests();
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in SAVED_ENV)) delete process.env[key];
  }
  Object.assign(process.env, SAVED_ENV);
  resetDevCloudEnvAuthorityForTests();
});

describe("agent development Cloud environment authority", () => {
  it("classifies Cloud-owned keys without capturing launcher markers or unrelated settings", () => {
    expect(isDevCloudEnvOwnedKey("ELIZAOS_CLOUD_API_KEY")).toBe(true);
    expect(isDevCloudEnvOwnedKey("eliza_cloud_future_flag")).toBe(true);
    expect(isDevCloudEnvOwnedKey("ELIZA_DEV_CLOUD_FUTURE_TOKEN")).toBe(true);
    expect(isDevCloudEnvOwnedKey("ELIZACLOUD_FUTURE_URL")).toBe(true);
    expect(isDevCloudEnvOwnedKey("WAIFU_ELIZA_CLOUD_AGENT_ID")).toBe(true);

    expect(isDevCloudEnvOwnedKey("ELIZA_DEV_SOURCE")).toBe(false);
    expect(isDevCloudEnvOwnedKey("ELIZA_DEV_CLOUD_ENV_AUTHORITY")).toBe(false);
    expect(isDevCloudEnvOwnedKey("ELIZA_DEV_CLOUD_TARGET")).toBe(false);
    expect(isDevCloudEnvOwnedKey("SMALL_MODEL")).toBe(false);
    expect(isDevCloudEnvOwnedKey("DISCORD_API_TOKEN")).toBe(false);

    expect(isDevCloudInternalEnvKey("ELIZA_DEV_SOURCE")).toBe(true);
    expect(isDevCloudInternalEnvKey("eliza_dev_cloud_env_authority")).toBe(true);
    expect(isDevCloudInternalEnvKey("ELIZA_DEV_CLOUD_TARGET")).toBe(true);
    expect(isDevCloudInternalEnvKey("ELIZAOS_CLOUD_API_KEY")).toBe(false);
  });

  it("strips persisted Cloud authority from every supported config nesting site", () => {
    const env = authorityEnv("staging-default");
    const config: Record<string, unknown> = {
      env: {
        vars: {
          ELIZAOS_CLOUD_API_KEY: "persisted-key",
          ELIZA_DEV_CLOUD_TARGET: "production",
          DISCORD_API_TOKEN: "keep-discord",
        },
        ELIZA_CLOUD_TOKEN: "persisted-token",
        OTHER_SETTING: "keep-other",
      },
      agents: {
        defaults: {
          settings: {
            ELIZA_CLOUD_API_KEY: "persisted-default-key",
            SMALL_MODEL: "keep-small",
            secrets: {
              ELIZAOS_CLOUD_SERVICE_KEY: "persisted-service-key",
              DISCORD_API_TOKEN: "keep-agent-discord",
            },
          },
        },
        list: [
          {
            settings: {
              ELIZACLOUD_TOKEN: "persisted-list-token",
              extra: { ELIZA_CLOUD_FUTURE_SECRET: "persisted-future" },
              CUSTOM_SETTING: "keep-custom",
            },
            env: {
              ELIZAOS_CLOUD_BASE_URL: "https://production.invalid/api/v1",
              PATH: "/usr/bin",
            },
          },
        ],
      },
      cloud: {
        apiKey: "persisted-cloud-key",
        baseUrl: "https://production.invalid/api/v1",
        customField: "keep-cloud-metadata",
      },
    };

    const snapshot = applyDevCloudConfigAuthority(config, env);

    expect(snapshot?.authority).toBe("staging-default");
    expect(config.deploymentTarget).toEqual({ runtime: "local" });
    expect(config.cloud).toEqual({
      customField: "keep-cloud-metadata",
      enabled: false,
      baseUrl: "https://api-staging.eliza.app/api/v1",
      apiKey: "",
    });
    expect(config.env).toEqual({
      vars: { DISCORD_API_TOKEN: "keep-discord" },
      OTHER_SETTING: "keep-other",
    });
    expect(config.agents).toEqual({
      defaults: {
        settings: {
          SMALL_MODEL: "keep-small",
          secrets: { DISCORD_API_TOKEN: "keep-agent-discord" },
        },
      },
      list: [
        {
          settings: { CUSTOM_SETTING: "keep-custom" },
          env: { PATH: "/usr/bin" },
        },
      ],
    });
  });

  it.each(["[REDACTED]", "vault://cloud/key", "   "])(
    "keeps the deny-fallback blank apiKey sentinel for unusable credentials: %s",
    (placeholder) => {
      const env: NodeJS.ProcessEnv = {
        ...authorityEnv("self-hosted"),
        ELIZAOS_CLOUD_API_KEY: placeholder,
        ELIZAOS_CLOUD_BASE_URL: "https://cloud.private.example/api/v1",
      };
      const config: Record<string, unknown> = {};

      applyDevCloudConfigAuthority(config, env);

      expect(config.cloud).toEqual({
        enabled: false,
        baseUrl: "https://cloud.private.example/api/v1",
        apiKey: "",
      });
    },
  );

  it("restores launcher-owned and compatibility keys, deletes late Cloud keys, and preserves unrelated env", () => {
    const env: NodeJS.ProcessEnv = {
      ...authorityEnv("staging-explicit"),
      ELIZAOS_CLOUD_API_KEY: "staging-launch-key",
      ELIZAOS_CLOUD_BASE_URL: "https://api-staging.eliza.app/api/v1",
      SMALL_MODEL: "staging-small",
      DISCORD_API_TOKEN: "original-discord",
    };
    const snapshot = captureDevCloudEnvAuthority(env);
    expect(snapshot).not.toBeNull();

    env.ELIZAOS_CLOUD_API_KEY = "late-production-key";
    env.ELIZAOS_CLOUD_BASE_URL = "https://api.eliza.app/api/v1";
    env.ELIZAOS_CLOUD_LATE_OVERRIDE = "late-cloud-value";
    env.SMALL_MODEL = "late-production-model";
    env.DISCORD_API_TOKEN = "later-discord";

    restoreDevCloudEnvAuthority(snapshot!, env);

    expect(env.ELIZAOS_CLOUD_API_KEY).toBe("staging-launch-key");
    expect(env.ELIZAOS_CLOUD_BASE_URL).toBe(
      "https://api-staging.eliza.app/api/v1",
    );
    expect(env.ELIZAOS_CLOUD_LATE_OVERRIDE).toBeUndefined();
    expect(env.SMALL_MODEL).toBe("staging-small");
    expect(env.DISCORD_API_TOKEN).toBe("later-discord");
  });

  it("projects a direct text route into a runtime overlay without handing text back to Cloud", () => {
    const env: NodeJS.ProcessEnv = {
      ...authorityEnv("staging-explicit"),
      ELIZAOS_CLOUD_API_KEY: "staging-key",
      ELIZAOS_CLOUD_USE_INFERENCE: "",
    };
    const overlay = createDevCloudRuntimeSettingsAuthorityOverlay(env, {
      serviceRouting: {
        llmText: { transport: "direct", backend: "local-inference" },
      },
    });

    expect(overlay.ELIZAOS_CLOUD_API_KEY).toBe("staging-key");
    expect(overlay.ELIZAOS_CLOUD_USE_INFERENCE).toBe("false");
  });

  it("marks authority views non-enumerably and materializes them without the marker", () => {
    const env = authorityEnv("staging-default");
    const source = {
      cloud: { apiKey: "durable-production-key" },
      feature: { enabled: true },
    };

    const view = createDevCloudConfigAuthorityView(source, env);
    const marker = Symbol.for("@elizaos/agent/dev-cloud-config-authority-view");
    const descriptor = Object.getOwnPropertyDescriptor(view, marker);

    expect(view).not.toBe(source);
    expect(isDevCloudConfigAuthorityView(view)).toBe(true);
    expect(descriptor).toMatchObject({
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
    expect(Object.keys(view)).not.toContain(marker.description);
    expect({ ...view }).not.toHaveProperty(marker);

    const materialized = materializeDevCloudConfigAuthorityView(view);
    expect(materialized).not.toBe(view);
    expect(isDevCloudConfigAuthorityView(materialized)).toBe(false);
    expect(Object.getOwnPropertySymbols(materialized)).not.toContain(marker);
  });

  it("merges only post-view mutations, including deletions, without persisting the projected Cloud topology", () => {
    const env: NodeJS.ProcessEnv = {
      ...authorityEnv("staging-explicit"),
      ELIZAOS_CLOUD_API_KEY: "staging-key",
      ELIZAOS_CLOUD_BASE_URL: "https://api-staging.eliza.app/api/v1",
    };
    const durable = {
      cloud: {
        apiKey: "durable-production-key",
        baseUrl: "https://api.eliza.app/api/v1",
      },
      wallet: {
        address: "0xold",
        staleCache: "remove-me",
      },
      untouched: { value: 7 },
    };
    const before = createDevCloudConfigAuthorityView(durable, env);
    const after = createDevCloudConfigAuthorityView(durable, env);
    after.wallet.address = "0xnew";
    delete (after.wallet as { staleCache?: string }).staleCache;

    const merged = mergeDevCloudConfigAuthorityMutation(
      durable,
      before,
      after,
    );

    expect(merged).toEqual({
      cloud: {
        apiKey: "durable-production-key",
        baseUrl: "https://api.eliza.app/api/v1",
      },
      wallet: { address: "0xnew" },
      untouched: { value: 7 },
    });
    expect(durable.wallet).toEqual({
      address: "0xold",
      staleCache: "remove-me",
    });
  });
});
