/**
 * BahiSaathi — Auth context
 *
 * Holds: current user, whether we're still checking, and login/register/logout.
 * On first load, if a token exists in localStorage, we validate it by
 * calling /auth/me. If that fails, we treat the user as logged out.
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { loginUser, registerUser, fetchCurrentUser } from "../api/auth";
import { TOKEN_KEY } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function login(phone, password) {
    const { access_token } = await loginUser(phone, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    const me = await fetchCurrentUser();
    setUser(me);
    return me;
  }

  async function register(payload) {
    await registerUser(payload);
    // Auto-login right after account creation — one less step for the user.
    return login(payload.phone, payload.password);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}