/**
 * BahiSaathi — Axios instance
 *
 * Every request automatically gets the JWT attached (if we have one).
 * Every response is watched for 401s — if the token is bad or expired,
 * we clear it and bounce to /login. This is the ONE place that logic lives.
 */
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const TOKEN_KEY = "bahisaathi_token";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Runs before every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Runs on every incoming response
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;