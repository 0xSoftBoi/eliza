import { describe, expect, it, vi } from "vitest";
import type {
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";
import type { McpProvider } from "../types";
import { handleMcpError } from "./error";

function provider(): McpProvider {
  return {
    values: { mcp: {}, mcpText: "" },
    data: { mcp: {} },
    text: "",
  } as McpProvider;
}

function runtime(response = "The MCP tool is temporarily unavailable.") {
  return {
    useModel: vi.fn(async () => response),
  } as unknown as IAgentRuntime;
}

describe("handleMcpError", () => {
  it("keeps the callback path alive when message content is missing", async () => {
    const testRuntime = runtime();
    const callback = vi.fn(async () => undefined) as unknown as HandlerCallback;
    const message = { content: undefined } as unknown as Memory;

    const result = await handleMcpError(
      { values: {} } as State,
      provider(),
      new Error("server unavailable"),
      testRuntime,
      message,
      "tool",
      callback,
    );

    expect(testRuntime.useModel).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({
      text: "The MCP tool is temporarily unavailable.",
      actions: ["REPLY"],
    });
    expect(result).toMatchObject({
      success: false,
      text: "Failed to execute MCP tool",
      values: {
        success: false,
        error: "server unavailable",
        errorType: "tool",
      },
    });
  });

  it("creates a usable values object when state.values is missing", async () => {
    const testRuntime = runtime("Resource lookup failed safely.");
    const callback = vi.fn(async () => undefined) as unknown as HandlerCallback;
    const state = { values: undefined } as unknown as State;
    const message = {
      content: { text: "read the resource" },
    } as unknown as Memory;

    await expect(
      handleMcpError(
        state,
        provider(),
        "resource exploded",
        testRuntime,
        message,
        "resource",
        callback,
      ),
    ).resolves.toMatchObject({
      success: false,
      text: "Failed to execute MCP resource",
    });
    expect(callback).toHaveBeenCalledWith({
      text: "Resource lookup failed safely.",
      actions: ["REPLY"],
    });
  });

  it("does not require message or state context when no callback is requested", async () => {
    const testRuntime = runtime();

    const result = await handleMcpError(
      undefined as unknown as State,
      provider(),
      "offline",
      testRuntime,
      { content: undefined } as unknown as Memory,
      "tool",
    );

    expect(testRuntime.useModel).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      text: "Failed to execute MCP tool",
      values: { error: "offline", errorType: "tool" },
      data: { op: "call_tool", mcpType: "tool" },
    });
  });
});
