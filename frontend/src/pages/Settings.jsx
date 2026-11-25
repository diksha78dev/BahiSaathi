/**
 * Settings page (inside AppLayout) — shop profile and password.
 *
 *   ProfileForm ──► saveProfile() ──► PATCH /auth/me ──► AuthProvider's user (sidebar updates)
 *   PasswordForm ──► POST /auth/change-password
 *
 * The user is already loaded by AuthProvider, so this page has no loading state of its own.
 */
import { KeyRound, Store } from "lucide-react";
import PasswordForm from "../components/PasswordForm";
import ProfileForm from "../components/ProfileForm";
import { useAuth } from "../hooks/useAuth";

export default function Settings() {
  const { user, saveProfile } = useAuth();

  return (
    <>
      <header className="header-flex" style={{ marginBottom: 0 }}>
        <div>
          <h1>Settings</h1>
          <p className="text-secondary">Your shop details and login.</p>
        </div>
      </header>

      <div className="content-grid">
        <section className="glass-card">
          <h3><Store size={18} /> Shop profile</h3>
          <ProfileForm user={user} onSave={saveProfile} />
        </section>

        <section className="glass-card">
          <h3><KeyRound size={18} /> Change password</h3>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}
