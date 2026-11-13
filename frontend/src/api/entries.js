/** Ledger entry endpoints — see backend/app/routers/entries.py */
import apiClient from "./client";

export const getEntries = () => apiClient.get("/entries/").then((res) => res.data);

/** entry: { customer_name?, item_name, quantity?, unit?, amount, payment_status } */
export const addManualEntry = (entry) => apiClient.post("/entries/manual", entry).then((res) => res.data);

export const markEntryPaid = (entryId) =>
  apiClient.patch(`/entries/${entryId}/mark-paid`).then((res) => res.data);

/** Uploads a bahi photo. Resolves to the scan: { status, entries_extracted, error_message, ... } */
export const uploadScan = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/entries/upload-scan", formData).then((res) => res.data);
};
