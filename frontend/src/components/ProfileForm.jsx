/**
 * Shop profile form: shop name, owner name, preferred language.
 * Phone is shown but read-only — it is the login id, so it isn't editable here.
 * Props: user (current user), onSave(changes) — returns the updated user, may throw.
 */
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../api/client";
import { LANGUAGES } from "../utils/languages";

const toForm = (user) => ({
  shop_name: user.shop_name,
  owner_name: user.owner_name,
  preferred_language: user.preferred_language,
});

/** Trim like the backend does, so "Sharma " vs "Sharma" doesn't count as a change */
const toChanges = (form) => ({
  shop_name: form.shop_name.trim(),
  owner_name: form.owner_name.trim(),
  preferred_language: form.preferred_language,
});

export default function ProfileForm({ user, onSave }) {
  const [form, setForm] = useState(() => toForm(user));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const changes = toChanges(form);
  const hasChanges = Object.keys(changes).some((field) => changes[field] !== user[field]);

  const updateField = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setSaved(false); // an old "Saved" message would be misleading once the form is edited again
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const updated = await onSave(changes);
      setForm(toForm(updated)); // show exactly what the server stored
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your profile."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor="shop-name">Shop name</label>
        <input id="shop-name" className="glass-input" value={form.shop_name} onChange={updateField("shop_name")} required maxLength={200} />
      </div>

      <div className="field-group">
        <label htmlFor="owner-name">Owner name</label>
        <input id="owner-name" className="glass-input" value={form.owner_name} onChange={updateField("owner_name")} required maxLength={200} />
      </div>

      <div className="field-group">
        <label htmlFor="phone">Phone (login)</label>
        <input id="phone" className="glass-input" value={user.phone} readOnly disabled />
        <p className="field-help">Your phone number is how you log in, so it can't be changed here.</p>
      </div>

      <div className="field-group">
        <label htmlFor="language">Preferred language</label>
        <select id="language" className="glass-input" value={form.preferred_language} onChange={updateField("preferred_language")}>
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
        <p className="field-help">
          Saved to your account for upcoming translations. The app screens are in English for now.
        </p>
      </div>

      {error && <div className="form-message error">{error}</div>}
      {saved && (
        <div className="form-message success">
          <CheckCircle2 size={16} /> Profile saved.
        </div>
      )}

      <button type="submit" className="glass-btn primary small" disabled={isSaving || !hasChanges}>
        {isSaving && <Loader2 size={16} className="pulse" />} Save changes
      </button>
    </form>
  );
}
