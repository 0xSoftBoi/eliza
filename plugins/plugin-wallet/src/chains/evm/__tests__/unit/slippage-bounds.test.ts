import { describe, expect, it } from "vitest";
import { MAX_SLIPPAGE_PERCENT } from "../../constants";
import { BridgeParamsSchema, SwapParamsSchema } from "../../types";

const TOKEN_A = "0x1111111111111111111111111111111111111111";
const TOKEN_B = "0x2222222222222222222222222222222222222222";
const MAX_BPS = Math.round(MAX_SLIPPAGE_PERCENT * 10_000);

const swap = (slippageBps: number | string) => ({
  chain: "mainnet",
  fromToken: TOKEN_A,
  toToken: TOKEN_B,
  amount: "1",
  slippageBps,
});

const bridge = (slippageBps: number | string) => ({
  fromChain: "mainnet",
  toChain: "base",
  fromToken: TOKEN_A,
  toToken: TOKEN_B,
  amount: "1",
  slippageBps,
});

describe("explicit EVM slippage bounds", () => {
  it.each([0, MAX_BPS, String(MAX_BPS)])("accepts swap slippage %s bps", (value) => {
    expect(SwapParamsSchema.parse(swap(value)).slippageBps).toBe(Number(value));
  });

  it.each([MAX_BPS + 1, 10_000])(
    "rejects swap slippage %s bps above the wallet ceiling",
    (value) => {
      expect(() => SwapParamsSchema.parse(swap(value))).toThrow();
    }
  );

  it.each([0, MAX_BPS, String(MAX_BPS)])("accepts bridge slippage %s bps", (value) => {
    expect(BridgeParamsSchema.parse(bridge(value)).slippageBps).toBe(Number(value));
  });

  it.each([MAX_BPS + 1, 10_000])(
    "rejects bridge slippage %s bps above the wallet ceiling",
    (value) => {
      expect(() => BridgeParamsSchema.parse(bridge(value))).toThrow();
    }
  );
});
