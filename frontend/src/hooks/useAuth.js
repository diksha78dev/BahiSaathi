import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/** Access the logged-in user and login/register/logout from any component */
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}
