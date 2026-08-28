import { describe, expect, it } from "vitest";
import type { Memory } from "../types/memory.js";
import type { SessionEntry } from "./types.js";
import {
  createSendPolicyProvider,
  createSessionProvider,
  createSessionSkillsProvider,
  extractSessionContext,
} from "./provider.js";

function memory(overrides: Record<string, unknown> = {}): Memory {
  return {
    entityId: "00000000-0000-0000-0000-000000000001",
    roomId: "00000000-0000-0000-0000-000000000002",
    content: { text: "hello" },
    ...overrides,
  } as Memory;
}

function sessionEntry(overrides: Record<string, unknown> = {}): SessionEntry {
  return {
    sessionId: "nested-session",
    updatedAt: 1,
    ...overrides,
  } as SessionEntry;
}

async function getProviderResult(
  provider: ReturnType<typeof createSessionProvider>,
  message: Memory,
) {
  return provider.get!({} as never, message, {} as never);
}

describe("session provider contract", () => {
  describe("extractSessionContext", () => {
    it("prefers direct session identity over metadata and nested session identity", () => {
      const nested = sessionEntry({ sessionId: "nested-session" });
      const result = extractSessionContext(
        memory({
          sessionId: "direct-session",
          sessionKey: "direct-key",
          metadata: {
            sessionId: "metadata-session",
            sessionKey: "metadata-key",
            session: nested,
          },
        }),
      );

      expect(result).toEqual({
        sessionId: "direct-session",
        sessionKey: "direct-key",
        entry: nested,
      });
    });

    it("falls back through metadata sessionId and then nested session entry", () => {
      const metadataEntry = sessionEntry({ sessionId: "nested-session" });

      expect(
        extractSessionContext(
          memory({
            metadata: {
              sessionId: "metadata-session",
              sessionKey: "metadata-key",
              session: metadataEntry,
            },
          }),
        ),
      ).toEqual({
        sessionId: "metadata-session",
        sessionKey: "metadata-key",
        entry: metadataEntry,
      });

      expect(
        extractSessionContext(
          memory({ metadata: { session: metadataEntry } }),
        ),
      ).toEqual({
        sessionId: "nested-session",
        sessionKey: undefined,
        entry: metadataEntry,
      });
    });

    it("returns null when no direct or metadata session identity exists", () => {
      expect(extractSessionContext(memory())).toBeNull();
      expect(extractSessionContext(memory({ metadata: {} }))).toBeNull();
    });
  });

  describe("createSendPolicyProvider", () => {
    it("renders explicit deny guidance and fail-closed send state", async () => {
      const provider = createSendPolicyProvider();
      const result = await provider.get!(
        {} as never,
        memory({
          metadata: {
            session: sessionEntry({ sendPolicy: "deny" }),
          },
        }),
        {} as never,
      );

      expect(result.text).toContain("SEND POLICY: DENY");
      expect(result.text).toContain("This session has sending DISABLED.");
      expect(result.text).toContain("Do NOT send messages to external channels.");
      expect(result.text).toContain("Do NOT use send/reply actions.");
      expect(result.values).toMatchObject({
        sendPolicy: "deny",
        canSend: false,
      });
      expect(result.data).toMatchObject({
        sendPolicy: "deny",
        canSend: false,
      });
    });

    it.each([
      ["no session", memory()],
      [
        "explicit allow",
        memory({
          metadata: { session: sessionEntry({ sendPolicy: "allow" }) },
        }),
      ],
      [
        "unspecified policy",
        memory({ metadata: { session: sessionEntry() } }),
      ],
    ])("keeps sending allowed for %s", async (_label, message) => {
      const provider = createSendPolicyProvider();
      const result = await provider.get!({} as never, message, {} as never);

      expect(result.text).toBe("");
      if (_label === "no session") {
        expect(result.data).toEqual({ sendPolicy: "allow" });
      } else {
        expect(result.values).toMatchObject({
          sendPolicy: "allow",
          canSend: true,
        });
        expect(result.data).toMatchObject({
          sendPolicy: "allow",
          canSend: true,
        });
      }
    });
  });

  describe("createSessionProvider", () => {
    it("renders the complete model-facing session snapshot and deny warning", async () => {
      const entry = sessionEntry({
        label: "Research room",
        chatType: "group",
        channel: "discord",
        modelOverride: "openai/gpt-5",
        thinkingLevel: "high",
        sendPolicy: "deny",
        totalTokens: 1234,
      });
      const result = await getProviderResult(
        createSessionProvider(),
        memory({
          sessionId: "direct-session",
          sessionKey: "agent:main:discord:group:123",
          metadata: { session: entry },
        }),
      );

      expect(result.text).toContain("Session ID: direct-session");
      expect(result.text).toContain(
        "Session Key: agent:main:discord:group:123",
      );
      expect(result.text).toContain("Label: Research room");
      expect(result.text).toContain("Chat Type: group");
      expect(result.text).toContain("Channel: discord");
      expect(result.text).toContain("Model Override: openai/gpt-5");
      expect(result.text).toContain("Thinking Level: high");
      expect(result.text).toContain(
        "SEND POLICY: DENY - Do not send messages externally.",
      );
      expect(result.text).toContain("Total Tokens Used: 1234");
      expect(result.values).toMatchObject({
        sessionId: "direct-session",
        sessionKey: "agent:main:discord:group:123",
        hasSession: true,
      });
      expect(result.data).toMatchObject({
        hasSession: true,
        sessionId: "direct-session",
        sessionKey: "agent:main:discord:group:123",
        entry,
      });
    });

    it("returns an explicit no-session state", async () => {
      const result = await getProviderResult(createSessionProvider(), memory());

      expect(result).toEqual({
        text: "No session context available.",
        data: { hasSession: false },
      });
    });
  });

  describe("createSessionSkillsProvider", () => {
    it("distinguishes no session from a session with no configured skills", async () => {
      const provider = createSessionSkillsProvider();
      const noSession = await provider.get!(
        {} as never,
        memory(),
        {} as never,
      );
      const noSkills = await provider.get!(
        {} as never,
        memory({ metadata: { session: sessionEntry() } }),
        {} as never,
      );

      expect(noSession).toEqual({
        text: "No session skills available.",
        data: { hasSkills: false },
      });
      expect(noSkills).toEqual({
        text: "No skills configured for this session.",
        data: { hasSkills: false, skills: [] },
      });
    });

    it("renders active skill names, prompt, and skill count", async () => {
      const provider = createSessionSkillsProvider();
      const result = await provider.get!(
        {} as never,
        memory({
          metadata: {
            session: sessionEntry({
              skillsSnapshot: {
                skills: [{ name: "research" }, { name: "wallet-safety" }],
                prompt: "Apply the active skill instructions.",
              },
            }),
          },
        }),
        {} as never,
      );

      expect(result.text).toBe(
        "Active Skills: research, wallet-safety\n\nApply the active skill instructions.",
      );
      expect(result.values).toEqual({
        skillCount: 2,
        skillNames: ["research", "wallet-safety"],
      });
      expect(result.data).toMatchObject({
        hasSkills: true,
        prompt: "Apply the active skill instructions.",
      });
    });
  });
});
