import { describe, expect, it } from "vitest";
import { AmountSchema, OptionalAmountSchema } from "../../types";

describe("strict EVM decimal amount validation", () => {
  it.each(["1", "1.0", "0.5", ".5", "1000000.000001"])(
    "accepts canonical decimal amount %s",
    (value) => {
      expect(AmountSchema.parse(value)).toBe(value);
    }
  );

  it.each(["1foo", "1 ETH", "1e3", "1E3", "1,000", "Infinity", "NaN", "-1", "0", "", " 1 "])(
    "rejects ambiguous or non-decimal amount %s",
    (value) => {
      expect(() => AmountSchema.parse(value)).toThrow();
    }
  );

  it("applies the same grammar to optional amounts", () => {
    expect(OptionalAmountSchema.parse(undefined)).toBeUndefined();
    expect(OptionalAmountSchema.parse("0.01")).toBe("0.01");
    expect(() => OptionalAmountSchema.parse("2tokens")).toThrow();
  });
});
