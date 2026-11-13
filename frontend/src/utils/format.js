/** Display helpers shared by the dashboard components */

/** 125000 → "₹1,25,000" (Indian digit grouping) */
export const formatRupees = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** "2026-11-13" → "13 Nov 2026" */
export const formatDate = (isoDate) =>
  new Date(isoDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** quantity 2, unit "kg" → "2 kg"; nothing → "" */
export const formatQuantity = (quantity, unit) => (quantity ? `${quantity}${unit ? ` ${unit}` : ""}` : "");
