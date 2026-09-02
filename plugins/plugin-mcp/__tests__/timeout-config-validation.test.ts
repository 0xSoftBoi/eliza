import { describe, expect, it } from "vitest";
import { isMcpSettings } from "../src/types";

function stdio(timeoutInMillis: unknown) {
  return { servers: { test: { type: "stdio", command: "node", timeoutInMillis } } };
}

function http(timeout: unknown) {
  return {
    servers: {
      test: { type: "streamable-http", url: "https://mcp.example.com", timeout },
    },
  };
}

describe("MCP timeout config validation", () => {
  it.each([1, 250, 60_000])("accepts positive finite stdio timeout %s", (value) => {
    expect(isMcpSettings(stdio(value))).toBe(true);
  });

  it.each([1, 250, 60_000])("accepts positive finite HTTP timeout %s", (value) => {
    expect(isMcpSettings(http(value))).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid stdio timeout %s",
    (value) => {
      expect(isMcpSettings(stdio(value))).toBe(false);
    }
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid HTTP timeout %s",
    (value) => {
      expect(isMcpSettings(http(value))).toBe(false);
    }
  );

  it("still permits omitted timeout fields", () => {
    expect(isMcpSettings({ servers: { stdio: { type: "stdio", command: "node" } } })).toBe(true);
    expect(
      isMcpSettings({
        servers: { remote: { type: "streamable-http", url: "https://mcp.example.com" } },
      })
    ).toBe(true);
  });
});
