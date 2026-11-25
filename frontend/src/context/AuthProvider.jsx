/**
 * Keeps track of who is logged in.
 *
 * The login token lives in localStorage so a page refresh keeps you logged in.
 * On first load, if a token exists we ask the backend (/auth/me) who it belongs
 * to; if that fails the token is stale and we treat the user as logged out.
 */
import { useEffect, useState } from "react";
import { fetchCurrentUser, loginUser, registerUser, updateProfile } from "../api/auth";
import { TOKEN_KEY } from "../api/client";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only show a loading state if there is a saved token to check
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    fetchCurrentUser()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(phone, password) {
    const { access_token } = await loginUser(phone, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    setUser(await fetchCurrentUser());
  }

  async function register(form) {
    await registerUser(form);
    await login(form.phone, form.password); // log straight in after sign-up
  }

  /** Save profile changes and swap in the returned user, so the sidebar name updates at once */
  async function saveProfile(changes) {
    const updated = await updateProfile(changes);
    setUser(updated);
    return updated;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  const value = { user, isLoading, isAuthenticated: Boolean(user), login, register, saveProfile, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
