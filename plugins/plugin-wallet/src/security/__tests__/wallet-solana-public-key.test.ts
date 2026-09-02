import { describe, expect, it } from "vitest";
import { assertSolanaTransferRecipientAuthorized } from "../wallet-context-safety.js";

const VALID = "9xQeWvG816bUx9EPfWJXn4xHLh1BaK7Z7QXDXuGpS9SW";
const REGEX_ONLY_INVALID = "11111111111111111111111111111111111111111111";

describe("Solana transfer recipient public-key validation", () => {
  it("rejects base58-looking strings that do not decode to a 32-byte public key", () => {
    const message = {
      content: { text: `Send 1 SOL to ${REGEX_ONLY_INVALID}.` },
    };

    expect(() =>
      assertSolanaTransferRecipientAuthorized(
        message as never,
        undefined,
        REGEX_ONLY_INVALID,
      ),
    ).toThrow(/valid Solana public key/i);
  });

  it("rejects the same malformed key even when supplied as structured parameters", () => {
    const message = { content: { text: "Execute the prepared transfer." } };

    expect(() =>
      assertSolanaTransferRecipientAuthorized(
        message as never,
        { parameters: { recipient: REGEX_ONLY_INVALID } },
        REGEX_ONLY_INVALID,
      ),
    ).toThrow(/valid Solana public key/i);
  });

  it("preserves canonical Solana public-key recipients", () => {
    const message = {
      content: { text: `Send 1 SOL to ${VALID}.` },
    };

    expect(() =>
      assertSolanaTransferRecipientAuthorized(
        message as never,
        undefined,
        VALID,
      ),
    ).not.toThrow();
  });
});
