import { describe, expect, it } from "vitest";
import { parseWalletRouterParams } from "./wallet-router";

const params = (amount: string | number) => ({
  subaction: "transfer",
  chain: "solana",
  amount,
});

describe("wallet router amount validation", () => {
  it.each(["1", "1.0", "0.5", ".5", 1, 0.5])(
    "accepts canonical positive amount %s",
    (amount) => {
      expect(parseWalletRouterParams(params(amount)).amount).toBe(
        String(amount),
      );
    },
  );

  it.each([
    "1e3",
    "1E3",
    "1,000",
    "1 SOL",
    "1foo",
    "Infinity",
    "NaN",
    "0",
    "-1",
  ])("rejects ambiguous amount %s before chain dispatch", (amount) => {
    expect(() => parseWalletRouterParams(params(amount))).toThrow();
  });
});
