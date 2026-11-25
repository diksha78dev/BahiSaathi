/** Customer endpoints — see backend/app/routers/customers.py */
import apiClient from "./client";

/**
 * Every customer with calculated fields:
 * { id, name, phone, notes, total_dues, oldest_unpaid_date, is_overdue, created_at }
 */
export const getCustomers = () => apiClient.get("/customers/").then((res) => res.data);

export const getCustomer = (customerId) => apiClient.get(`/customers/${customerId}`).then((res) => res.data);

/** customer: { name, phone?, notes? } */
export const createCustomer = (customer) => apiClient.post("/customers/", customer).then((res) => res.data);

/** changes: only the fields to update, e.g. { phone } */
export const updateCustomer = (customerId, changes) =>
  apiClient.patch(`/customers/${customerId}`, changes).then((res) => res.data);

/** Fails with a readable message while the customer still owes money */
export const deleteCustomer = (customerId) => apiClient.delete(`/customers/${customerId}`);
