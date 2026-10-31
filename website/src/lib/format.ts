/**
 * Formats monetary amounts stored in integer paise into INR currency representation.
 * Example: formatPrice(129900) -> "₹1,299"
 */
export function formatPrice(paise: number, includeDecimals = false): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(rupees);
}

/**
 * Calculates discount percentage between MRP and selling price in paise.
 */
export function calculateDiscountPercentage(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= pricePaise || mrpPaise <= 0) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
