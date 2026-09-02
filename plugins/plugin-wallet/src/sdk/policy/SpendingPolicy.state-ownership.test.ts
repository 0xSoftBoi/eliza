import { describe, expect, it } from "vitest";
import { type PaymentIntent, SpendingPolicy } from "./SpendingPolicy";

const payment = (amount = 80): PaymentIntent => ({
  merchant: "0xABC123",
  amount,
  description: "original",
});

describe("SpendingPolicy state ownership", () => {
  it("snapshots a payment when creating a draft", async () => {
    const policy = new SpendingPolicy({ draftThreshold: 50 });
    const intent = payment();
    const result = await policy.check(intent);

    intent.amount = 1;
    intent.description = "mutated outside policy";

    const [draft] = policy.getAllDrafts();
    expect(result.status).toBe("draft");
    expect(draft.payment.amount).toBe(80);
    expect(draft.payment.description).toBe("original");
  });

  it("returns detached draft snapshots so callers cannot rewrite policy state", async () => {
    const policy = new SpendingPolicy({ draftThreshold: 50 });
    await policy.check(payment());

    const [external] = policy.getPendingDrafts();
    external.payment.amount = 1;
    external.approved = true;

    const [stored] = policy.getAllDrafts();
    expect(stored.payment.amount).toBe(80);
    expect(stored.approved).toBe(false);
  });

  it("returns detached audit entries", async () => {
    const policy = new SpendingPolicy({});
    await policy.check(payment(10));

    const [external] = policy.getAuditLog();
    external.amount = 999;
    external.status = "rejected";

    const [stored] = policy.getAuditLog();
    expect(stored.amount).toBe(10);
    expect(stored.status).toBe("approved");
  });

  it("keeps draft approval and rejection mutually terminal", async () => {
    const approvedPolicy = new SpendingPolicy({ draftThreshold: 50 });
    const approved = await approvedPolicy.check(payment());
    expect(approvedPolicy.approveDraft(approved.draftId as string)).toBe(true);
    expect(approvedPolicy.rejectDraft(approved.draftId as string)).toBe(false);

    const rejectedPolicy = new SpendingPolicy({ draftThreshold: 50 });
    const rejected = await rejectedPolicy.check(payment());
    expect(rejectedPolicy.rejectDraft(rejected.draftId as string)).toBe(true);
    expect(rejectedPolicy.approveDraft(rejected.draftId as string)).toBe(false);
  });

  it("keeps repeated same-state decisions idempotent", async () => {
    const policy = new SpendingPolicy({ draftThreshold: 50 });
    const result = await policy.check(payment());
    const draftId = result.draftId as string;

    expect(policy.approveDraft(draftId)).toBe(true);
    expect(policy.approveDraft(draftId)).toBe(true);
  });
});
