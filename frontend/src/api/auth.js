/** Auth endpoints — see backend/app/routers/auth.py */
import apiClient from "./client";

export const registerUser = (form) => apiClient.post("/auth/register", form).then((res) => res.data);

/** Returns { access_token, token_type } */
export const loginUser = (phone, password) =>
  apiClient.post("/auth/login", { phone, password }).then((res) => res.data);

export const fetchCurrentUser = () => apiClient.get("/auth/me").then((res) => res.data);

/** PATCH only the fields you pass: { shop_name, owner_name, preferred_language }. Returns the updated user. */
export const updateProfile = (changes) => apiClient.patch("/auth/me", changes).then((res) => res.data);

/** 204 on success; 400 with a message if the current password is wrong */
export const changePassword = (currentPassword, newPassword) =>
  apiClient.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
