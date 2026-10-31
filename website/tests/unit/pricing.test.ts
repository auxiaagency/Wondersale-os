import { describe, it, expect } from "vitest";
import { formatPrice, calculateDiscountPercentage } from "@/lib/format";

describe("Pricing and formatting utilities", () => {
  it("formats integer paise to INR currency string properly", () => {
    expect(formatPrice(129900)).toBe("₹1,299");
    expect(formatPrice(64900)).toBe("₹649");
    expect(formatPrice(0)).toBe("₹0");
  });

  it("calculates discount percentage accurately", () => {
    // MRP ₹2,490 (249000 paise), Selling Price ₹1,299 (129900 paise) -> ~48% discount
    const discount = calculateDiscountPercentage(249000, 129900);
    expect(discount).toBe(48);

    // No discount case
    expect(calculateDiscountPercentage(10000, 10000)).toBe(0);
    expect(calculateDiscountPercentage(10000, 12000)).toBe(0);
  });
});
