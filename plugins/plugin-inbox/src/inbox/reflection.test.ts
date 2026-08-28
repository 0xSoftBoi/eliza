import type { IAgentRuntime } from "@elizaos/core";
import { describe, expect, it, vi } from "vitest";
import {
  reflectOnAutoReply,
  reflectOnSendConfirmation,
} from "./reflection.ts";

const RAW_UNPARSEABLE = `${"a".repeat(99)}😀${"b".repeat(20)}`;
const DIAGNOSTIC_PREFIX = "Could not parse reflection: ";

function expectBoundedWellFormedDiagnostic(reasoning: string): void {
  expect(reasoning.startsWith(DIAGNOSTIC_PREFIX)).toBe(true);
  expect(reasoning.includes("😀")).toBe(false);
  expect(reasoning.length).toBeLessThanOrEqual(
    DIAGNOSTIC_PREFIX.length + 100,
  );
  expect(
    /[\uD800-\uDFFF]/.test(
      reasoning.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""),
    ),
  ).toBe(false);
}

describe("inbox reflection diagnostics", () => {
  it("truncates unparseable auto-reply reflection text with surrogate safety", async () => {
    const runtime = {
      useModel: vi.fn().mockResolvedValue(RAW_UNPARSEABLE),
    } as unknown as IAgentRuntime;

    const result = await reflectOnAutoReply(runtime, {
      senderName: "Alice",
      source: "email",
      inboundText: "Hello there",
      replyText: "Hi Alice",
    });

    expect(result.approved).toBe(false);
    expectBoundedWellFormedDiagnostic(result.reasoning);
  });

  it("truncates unparseable send-confirmation reflection text with surrogate safety", async () => {
    const runtime = {
      useModel: vi.fn().mockResolvedValue(RAW_UNPARSEABLE),
    } as unknown as IAgentRuntime;

    const result = await reflectOnSendConfirmation(runtime, {
      userMessage: "send it",
      draftText: "Hi Alice",
      channelName: "email",
      recipientName: "Alice",
    });

    expect(result.confirmed).toBe(false);
    expectBoundedWellFormedDiagnostic(result.reasoning);
  });
});