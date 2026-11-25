/**
 * Change-password form: current password, new password, confirm.
 * The "passwords match" check runs here (no need for a round trip);
 * everything else — wrong current password, too short — comes from the backend.
 */
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { changePassword } from "../api/auth";
import { getErrorMessage } from "../api/client";

const MIN_PASSWORD_LENGTH = 6; // same rule as registration (backend enforces it too)
const EMPTY = { current: "", next: "", confirm: "" };

export default function PasswordForm() {
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const updateField = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.next !== form.confirm) {
      setError("New password and confirmation don't match.");
      return;
    }

    setIsSaving(true);
    try {
      await changePassword(form.current, form.next);
      setForm(EMPTY); // don't leave passwords sitting in the inputs
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't change your password."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" className="glass-input"
          value={form.current} onChange={updateField("current")} required />
      </div>

      <div className="field-group">
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" className="glass-input"
          value={form.next} onChange={updateField("next")} required minLength={MIN_PASSWORD_LENGTH} />
        <p className="field-help">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>

      <div className="field-group">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" className="glass-input"
          value={form.confirm} onChange={updateField("confirm")} required minLength={MIN_PASSWORD_LENGTH} />
      </div>

      {error && <div className="form-message error">{error}</div>}
      {saved && (
        <div className="form-message success">
          <CheckCircle2 size={16} /> Password changed. Use the new one next time you log in.
        </div>
      )}

      <button type="submit" className="glass-btn primary small" disabled={isSaving}>
        {isSaving && <Loader2 size={16} className="pulse" />} Change password
      </button>
    </form>
  );
}
