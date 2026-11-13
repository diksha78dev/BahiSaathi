/** Customer endpoints — see backend/app/routers/customers.py */
import apiClient from "./client";

/** Every customer with their calculated total_dues */
export const getCustomers = () => apiClient.get("/customers/").then((res) => res.data);
