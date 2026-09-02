import { describe, expect, it } from "vitest";
import { SpendingPolicy } from "./SpendingPolicy";

const merchant = "0xABC123";

describe("SpendingPolicy amount validation", () => {
  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects invalid payment amount %s", async (amount) => {
    const policy = new SpendingPolicy({
      rollingCap: { maxAmount: 100, windowMs: 86_400_000 },
    });
    const result = await policy.check({ merchant, amount });
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/finite positive number/i);
  });

  it("does not let a negative payment create rolling-cap headroom", async () => {
    const policy = new SpendingPolicy({
      rollingCap: { maxAmount: 100, windowMs: 86_400_000 },
    });

    expect((await policy.check({ merchant, amount: 80 })).status).toBe(
      "approved",
    );
    expect((await policy.check({ merchant, amount: -100 })).status).toBe(
      "rejected",
    );
    expect((await policy.check({ merchant, amount: 30 })).status).toBe(
      "rejected",
    );
  });

  it("preserves positive finite payments", async () => {
    const policy = new SpendingPolicy({});
    expect((await policy.check({ merchant, amount: 1 })).status).toBe(
      "approved",
    );
  });
});
