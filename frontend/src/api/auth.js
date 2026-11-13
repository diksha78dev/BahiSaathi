/** Auth endpoints — see backend/app/routers/auth.py */
import apiClient from "./client";

export const registerUser = (form) => apiClient.post("/auth/register", form).then((res) => res.data);

/** Returns { access_token, token_type } */
export const loginUser = (phone, password) =>
  apiClient.post("/auth/login", { phone, password }).then((res) => res.data);

export const fetchCurrentUser = () => apiClient.get("/auth/me").then((res) => res.data);
