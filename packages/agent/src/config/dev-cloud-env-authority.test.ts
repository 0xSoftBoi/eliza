import { describe, expect, it } from "vitest";
import {
  applyDevCloudConfigAuthority,
  captureDevCloudEnvAuthority,
  createDevCloudConfigAuthorityView,
  DEV_CLOUD_ENV_AUTHORITY_KEY,
  isDevCloudConfigAuthorityView,
  isDevCloudEnvOwnedKey,
  isDevCloudInternalEnvKey,
  materializeDevCloudConfigAuthorityView,
  mergeDevCloudConfigAuthorityMutation,
  restoreDevCloudEnvAuthority,
} from "./dev-cloud-env-authority.ts";

function authorityEnv(
  authority:
    | "staging-default"
    | "staging-explicit"
    | "production"
    | "offline"
    | "self-hosted",
  values: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    ELIZA_DEV_SOURCE: "1",
    [DEV_CLOUD_ENV_AUTHORITY_KEY]: authority,
    ...values,
  };
}

describe("dev Cloud env authority module contract", () => {
  it("classifies Cloud-owned keys without swallowing launcher markers or unrelated provider settings", () => {
    expect(isDevCloudEnvOwnedKey("ELIZAOS_CLOUD_API_KEY")).toBe(true);
    expect(isDevCloudEnvOwnedKey("eliza_cloud_future_flag")).toBe(true);
    expect(isDevCloudEnvOwnedKey("ELIZA_DEV_CLOUD_FUTURE_FLAG")).toBe(true);
    expect(isDevCloudEnvOwnedKey("WAIFU_ELIZA_CLOUD_AGENT_ID")).toBe(true);

    for (const key of [
      "ELIZA_DEV_SOURCE",
      DEV_CLOUD_ENV_AUTHORITY_KEY,
      "ELIZA_DEV_CLOUD_TARGET",
    ]) {
      expect(isDevCloudInternalEnvKey(key)).toBe(true);
      expect(isDevCloudEnvOwnedKey(key)).toBe(false);
    }

    expect(isDevCloudEnvOwnedKey("SMALL_MODEL")).toBe(false);
    expect(isDevCloudEnvOwnedKey("DISCORD_API_TOKEN")).toBe(false);
    expect(isDevCloudInternalEnvKey("DISCORD_API_TOKEN")).toBe(false);
  });

  it("strips persisted Cloud authority from every supported config nesting site", () => {
    const config: Record<string, unknown> = {
      env: {
        ELIZAOS_CLOUD_API_KEY: "persisted-top-level",
        KEEP_ENV: "preserved",
        vars: {
          ELIZA_CLOUD_TOKEN: "persisted-nested",
          ELIZA_DEV_SOURCE: "persisted-internal-marker",
          KEEP_VAR: "preserved",
        },
      },
      agents: {
        defaults: {
          settings: {
            ELIZAOS_CLOUD_BASE_URL: "https://persisted.example",
            KEEP_DEFAULT: "preserved",
            secrets: {
              ELIZAOS_CLOUD_SERVICE_KEY: "persisted-service-key",
              KEEP_SECRET: "preserved",
            },
          },
        },
        list: [
          {
            settings: {
              env: {
                ELIZA_CLOUD_AUTH_TOKEN: "persisted-auth-token",
                KEEP_AGENT_ENV: "preserved",
              },
            },
            env: {
              ELIZA_DEV_CLOUD_TARGET: "production",
              KEEP_TOP_AGENT_ENV: "preserved",
            },
          },
        ],
      },
    };

    applyDevCloudConfigAuthority(
      config,
      authorityEnv("staging-default", {
        ELIZAOS_CLOUD_BASE_URL: "https://api-staging.eliza.app/api/v1",
      }),
    );

    expect(config.env).toEqual({
      KEEP_ENV: "preserved",
      vars: { KEEP_VAR: "preserved" },
    });
    expect(config.agents).toEqual({
      defaults: {
        settings: {
          KEEP_DEFAULT: "preserved",
          secrets: { KEEP_SECRET: "preserved" },
        },
      },
      list: [
        {
          settings: { env: { KEEP_AGENT_ENV: "preserved" } },
          env: { KEEP_TOP_AGENT_ENV: "preserved" },
        },
      ],
    });
  });

  it("projects a blank credential sentinel whenever launch authority must fail closed", () => {
    for (const authority of ["staging-default", "offline"] as const) {
      const config: Record<string, unknown> = {
        cloud: {
          enabled: true,
          apiKey: "persisted-production-key",
          serviceKey: "persisted-service-key",
        },
      };
      applyDevCloudConfigAuthority(
        config,
        authorityEnv(authority, {
          ELIZAOS_CLOUD_API_KEY: "launch-key-that-must-not-enable-cloud",
        }),
      );
      expect(config.cloud).toMatchObject({ enabled: false, apiKey: "" });
      expect((config.cloud as Record<string, unknown>).serviceKey).toBeUndefined();
    }

    for (const unusable of ["", "   ", "[REDACTED]", " vault://cloud/api-key "]) {
      const config: Record<string, unknown> = {};
      applyDevCloudConfigAuthority(
        config,
        authorityEnv("staging-explicit", { ELIZAOS_CLOUD_API_KEY: unusable }),
      );
      expect(config.cloud).toMatchObject({ enabled: false, apiKey: "" });
    }
  });

  it("rewinds owned and model-alias env mutations while leaving unrelated env alone", () => {
    const env = authorityEnv("staging-explicit", {
      ELIZAOS_CLOUD_API_KEY: "launch-key",
      SMALL_MODEL: "launch-small-model",
      DISCORD_API_TOKEN: "before",
    });
    const snapshot = captureDevCloudEnvAuthority(env);
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error("Expected a launcher authority snapshot");

    env.ELIZAOS_CLOUD_API_KEY = "polluted-key";
    env.ELIZA_CLOUD_TOKEN = "later-owned-token";
    env.SMALL_MODEL = "polluted-small-model";
    env.DISCORD_API_TOKEN = "after";

    restoreDevCloudEnvAuthority(snapshot, env);

    expect(env.ELIZAOS_CLOUD_API_KEY).toBe("launch-key");
    expect(env.ELIZA_CLOUD_TOKEN).toBeUndefined();
    expect(env.SMALL_MODEL).toBe("launch-small-model");
    expect(env.DISCORD_API_TOKEN).toBe("after");
  });

  it("marks authority views non-enumerably and materializes them without the marker", () => {
    const view = createDevCloudConfigAuthorityView(
      { nested: { keep: true } },
      authorityEnv("staging-default"),
    );

    expect(isDevCloudConfigAuthorityView(view)).toBe(true);
    const marker = Object.getOwnPropertySymbols(view).find(
      (symbol) => (view as Record<PropertyKey, unknown>)[symbol] === true,
    );
    expect(marker).toBeDefined();
    if (!marker) throw new Error("Expected the authority-view symbol marker");
    expect(Object.getOwnPropertyDescriptor(view, marker)).toMatchObject({
      configurable: false,
      enumerable: false,
      writable: false,
      value: true,
    });
    expect(isDevCloudConfigAuthorityView({ ...view })).toBe(false);

    const materialized = materializeDevCloudConfigAuthorityView(view);
    expect(materialized).not.toBe(view);
    expect(materialized).toEqual(view);
    expect(isDevCloudConfigAuthorityView(materialized)).toBe(false);
  });

  it("merges post-view deletions without persisting the authority projection", () => {
    const durable = {
      profile: {
        name: "agent",
        preferences: { theme: "dark", language: "en" },
      },
      env: {
        ELIZAOS_CLOUD_API_KEY: "persisted-production-key",
        KEEP_ENV: "preserved",
      },
      cloud: {
        enabled: true,
        apiKey: "persisted-production-key",
        baseUrl: "https://api.eliza.app/api/v1",
      },
    };
    const env = authorityEnv("staging-default", {
      ELIZAOS_CLOUD_BASE_URL: "https://api-staging.eliza.app/api/v1",
    });
    const before = createDevCloudConfigAuthorityView(durable, env);
    const after = createDevCloudConfigAuthorityView(durable, env);

    delete after.profile.preferences.theme;
    after.profile.name = "renamed-agent";

    const merged = mergeDevCloudConfigAuthorityMutation(durable, before, after);

    expect(merged.profile).toEqual({
      name: "renamed-agent",
      preferences: { language: "en" },
    });
    expect(merged.env).toEqual(durable.env);
    expect(merged.cloud).toEqual(durable.cloud);
    expect(isDevCloudConfigAuthorityView(merged)).toBe(false);
  });

  it("returns the mutated config directly when the before snapshot is not an authority view", () => {
    const durable = { value: 1, nested: { keep: true } };
    const before = structuredClone(durable);
    const after = { value: 2, nested: { keep: false } };

    expect(mergeDevCloudConfigAuthorityMutation(durable, before, after)).toBe(after);
  });
});
