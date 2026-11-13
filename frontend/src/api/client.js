/**
 * BahiSaathi — the one Axios instance every API call goes through.
 *
 *  - Adds the saved login token to every request.
 *  - On a 401 (token missing/expired), clears the token and sends the user to /login.
 *  - getErrorMessage() turns any backend error into one readable sentence.
 */
import axios from "axios";

export const TOKEN_KEY = "bahisaathi_token";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginAttempt = error.config?.url === "/auth/login";
    if (error.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

/**
 * FastAPI sends errors as { detail: "message" } or, for validation errors,
 * { detail: [{ loc: [...], msg: "..." }] }. Return a single readable string.
 */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const { loc = [], msg } = detail[0];
    const field = loc[loc.length - 1];
    return typeof field === "string" ? `${field.replaceAll("_", " ")}: ${msg}` : msg;
  }
  if (!error?.response) return "Can't reach the server. Is the backend running?";
  return fallback;
}

export default apiClient;
