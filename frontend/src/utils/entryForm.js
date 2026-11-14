/**
 * Converting between an entry as the API sends/expects it and the strings an
 * <input> holds. Shared by the manual entry form and the scan review table so
 * both build exactly the same request body.
 */

/** A blank form row */
export const EMPTY_ENTRY_FORM = {
  customer_name: "",
  item_name: "",
  quantity: "",
  unit: "",
  amount: "",
  transaction_date: "",
  payment_status: "udhaar",
};

/** API entry (numbers / nulls) → form strings */
export const entryToForm = (entry) => ({
  customer_name: entry.customer_name ?? "",
  item_name: entry.item_name ?? "",
  quantity: entry.quantity ?? "",
  unit: entry.unit ?? "",
  amount: entry.amount ?? "",
  transaction_date: entry.transaction_date ?? "",
  payment_status: entry.payment_status ?? "udhaar",
});

/** Form strings → request body. Empty optional fields become null (backend defaults the date to today). */
export const formToEntry = (form) => ({
  customer_name: form.customer_name.trim() || null,
  item_name: form.item_name.trim(),
  quantity: form.quantity === "" ? null : Number(form.quantity),
  unit: form.unit.trim() || null,
  amount: Number(form.amount),
  transaction_date: form.transaction_date || null,
  payment_status: form.payment_status,
});

/** Same minimum rules the backend enforces: an item name and a positive amount */
export const isEntryFormValid = (form) => form.item_name.trim() !== "" && Number(form.amount) > 0;
