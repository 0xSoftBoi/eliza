import { describe, expect, it } from "vitest";
import { assertEvmTransferRecipientAuthorized } from "../wallet-context-safety.js";

const ZERO = "0x0000000000000000000000000000000000000000";
const VALID = "0xBa07FA241B7cf5abbb9b4e5803b481B62C5B5222";

describe("EVM transfer recipient burn protection", () => {
  it("rejects the zero address even when the user explicitly supplied it", () => {
    const message = {
      content: { text: `Send 1 ETH to ${ZERO}.` },
    };

    expect(() =>
      assertEvmTransferRecipientAuthorized(message as never, undefined, ZERO),
    ).toThrow(/zero address/i);
  });

  it("rejects the zero address when supplied through structured parameters", () => {
    const message = { content: { text: "Execute the prepared transfer." } };

    expect(() =>
      assertEvmTransferRecipientAuthorized(
        message as never,
        { parameters: { recipient: ZERO } },
        ZERO,
      ),
    ).toThrow(/zero address/i);
  });

  it("preserves explicit valid-recipient behavior", () => {
    const message = {
      content: { text: `Send 1 ETH to ${VALID}.` },
    };

    expect(() =>
      assertEvmTransferRecipientAuthorized(message as never, undefined, VALID),
    ).not.toThrow();
  });
});
