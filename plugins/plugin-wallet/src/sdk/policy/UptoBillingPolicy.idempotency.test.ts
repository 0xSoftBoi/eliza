import { describe, expect, it } from "vitest";
import { UptoBillingPolicy } from "./UptoBillingPolicy.js";

function createAuthorization(policy: UptoBillingPolicy) {
  return policy.authorize({
    authorizationId: "auth-1",
    service: "example-service",
    network: "base",
    asset: "USDC",
    payTo: "0x1111111111111111111111111111111111111111",
    maxAmount: 1_000n,
  });
}

describe("UptoBillingPolicy settlement idempotency", () => {
  it("does not book a retried txHash twice", () => {
    const policy = new UptoBillingPolicy();
    createAuthorization(policy);

    const first = policy.recordSettlement("auth-1", 250n, {
      txHash: "0xsettlement",
    });
    const replay = policy.recordSettlement("auth-1", 250n, {
      txHash: "0xsettlement",
    });

    expect(first.authorization.settledAmount).toBe(250n);
    expect(replay.authorization.settledAmount).toBe(250n);
    expect(replay.authorization.remainingAmount).toBe(750n);
    expect(replay.settlements).toHaveLength(1);
    expect(
      replay.ledgerDeltas.filter((delta) => delta.type === "settlement"),
    ).toHaveLength(1);
    expect(policy.getNetWalletDelta("auth-1")).toBe(-250n);
  });

  it("rejects a conflicting amount for an existing txHash", () => {
    const policy = new UptoBillingPolicy();
    createAuthorization(policy);

    policy.recordSettlement("auth-1", 250n, { txHash: "0xsettlement" });

    expect(() =>
      policy.recordSettlement("auth-1", 300n, { txHash: "0xsettlement" }),
    ).toThrow(/conflicting amount/);
    expect(policy.getAuthorization("auth-1")?.settledAmount).toBe(250n);
  });

  it("accepts an exact replay after the authorization was finalized", () => {
    const policy = new UptoBillingPolicy();
    createAuthorization(policy);

    policy.recordSettlement("auth-1", 250n, {
      txHash: "0xsettlement",
      finalize: true,
    });

    const replay = policy.recordSettlement("auth-1", 250n, {
      txHash: "0xsettlement",
    });

    expect(replay.authorization.status).toBe("settled");
    expect(replay.authorization.settledAmount).toBe(250n);
    expect(replay.authorization.releasedAmount).toBe(750n);
    expect(replay.settlements).toHaveLength(1);
  });
});
