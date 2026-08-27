import { describe, expect, it } from "vitest";
import { SpendingPolicy } from "./SpendingPolicy.js";

describe("SpendingPolicy draft rolling-cap accounting", () => {
  it("counts an approved draft against subsequent rolling-cap checks", async () => {
    const policy = new SpendingPolicy({
      rollingCap: { maxAmount: 100, windowMs: 60_000 },
      draftThreshold: 50,
    });

    const draft = await policy.check({ merchant: "merchant-a", amount: 60 });
    expect(draft.status).toBe("draft");
    expect(draft.draftId).toBeDefined();
    expect(policy.approveDraft(draft.draftId!)).toBe(true);

    const next = await policy.check({ merchant: "merchant-b", amount: 50 });
    expect(next.status).toBe("rejected");
    expect(next.reason).toContain("Rolling spend cap exceeded");
  });

  it("re-checks available rolling-cap capacity when a draft is approved", async () => {
    const policy = new SpendingPolicy({
      rollingCap: { maxAmount: 100, windowMs: 60_000 },
      draftThreshold: 50,
    });

    const first = await policy.check({ merchant: "merchant-a", amount: 60 });
    const second = await policy.check({ merchant: "merchant-b", amount: 60 });
    expect(first.status).toBe("draft");
    expect(second.status).toBe("draft");

    expect(policy.approveDraft(first.draftId!)).toBe(true);
    expect(policy.approveDraft(second.draftId!)).toBe(false);
    expect(policy.getPendingDrafts().map((draft) => draft.draftId)).toContain(
      second.draftId,
    );
  });

  it("does not double-count a retried approval", async () => {
    const policy = new SpendingPolicy({
      rollingCap: { maxAmount: 100, windowMs: 60_000 },
      draftThreshold: 50,
    });

    const draft = await policy.check({ merchant: "merchant-a", amount: 60 });
    expect(draft.status).toBe("draft");

    expect(policy.approveDraft(draft.draftId!)).toBe(true);
    expect(policy.approveDraft(draft.draftId!)).toBe(true);

    const next = await policy.check({ merchant: "merchant-b", amount: 40 });
    expect(next.status).toBe("approved");
  });
});
