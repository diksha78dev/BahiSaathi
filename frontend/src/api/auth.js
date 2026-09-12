/**
 * BahiSaathi — Auth API calls
 *
 * IMPORTANT: /auth/login uses FastAPI's OAuth2PasswordRequestForm, which
 * expects form-urlencoded data with fields named "username" and "password"
 * — NOT JSON, and NOT "phone". We translate that here so the rest of the
 * app never has to think about it.
 */
import apiClient from "./client";

export async function registerUser(payload) {
  const { data } = await apiClient.post("/auth/register", payload);
  return data;
}

export async function loginUser(phone, password) {
  const form = new URLSearchParams();
  form.append("username", phone);
  form.append("password", password);

  const { data } = await apiClient.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data; // { access_token, token_type }
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}