/** Ledger entry endpoints — see backend/app/routers/entries.py */
import apiClient from "./client";

export const getEntries = () => apiClient.get("/entries/").then((res) => res.data);

/** entry: { customer_name?, item_name, quantity?, unit?, amount, payment_status } */
export const addManualEntry = (entry) => apiClient.post("/entries/manual", entry).then((res) => res.data);

export const markEntryPaid = (entryId) =>
  apiClient.patch(`/entries/${entryId}/mark-paid`).then((res) => res.data);

/**
 * Uploads a bahi photo. Nothing is saved yet — resolves to the scan with the AI's
 * draft: { id, status: "needs_review" | "failed", extracted_entries, error_message, ... }
 */
export const uploadScan = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/entries/upload-scan", formData).then((res) => res.data);
};

/** Saves the reviewed lines to the ledger. entries: same shape as addManualEntry, plus confidence */
export const confirmScan = (scanId, entries) =>
  apiClient.post(`/entries/scan/${scanId}/confirm`, { entries }).then((res) => res.data);

/** Throws the AI draft away without saving anything */
export const discardScan = (scanId) =>
  apiClient.post(`/entries/scan/${scanId}/discard`).then((res) => res.data);
