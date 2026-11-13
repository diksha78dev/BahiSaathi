/** Report endpoints — see backend/app/routers/reports.py */
import apiClient from "./client";

/** { total_sales_this_month, total_udhaar, total_customers, scans_this_month } */
export const getDashboardStats = () => apiClient.get("/reports/dashboard").then((res) => res.data);

/** Customers who owe money, highest dues first */
export const getDues = () => apiClient.get("/reports/dues").then((res) => res.data);
