/**
 * Name / phone / notes form, used both to add a customer and to edit one.
 * Props: initial (customer to edit, or nothing for a new one), submitLabel,
 *        onSubmit({ name, phone, notes }) — may throw; the error is shown here —
 *        onCancel (optional).
 */
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../api/client";

/** API customer (null fields) → form strings, so inputs are never uncontrolled */
const toForm = (customer) => ({
  name: customer?.name ?? "",
  phone: customer?.phone ?? "",
  notes: customer?.notes ?? "",
});

/** Form strings → API body; a blank optional field is sent as null (clears it) */
const toCustomer = (form) => ({
  name: form.name.trim(),
  phone: form.phone.trim() || null,
  notes: form.notes.trim() || null,
});

export default function CustomerForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await onSubmit(toCustomer(form));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the customer."));
      setIsSaving(false); // only on failure: on success the parent closes or resets this form
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="field-group">
          <label htmlFor="customer-name">Name</label>
          <input id="customer-name" className="glass-input" placeholder="e.g. Ramesh Singh" value={form.name} onChange={updateField("name")} required />
        </div>
        <div className="field-group">
          <label htmlFor="customer-phone">Phone (Optional)</label>
          <input id="customer-phone" type="tel" className="glass-input" placeholder="e.g. 98765 43210" value={form.phone} onChange={updateField("phone")} />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="customer-notes">Notes (Optional)</label>
        <textarea id="customer-notes" rows={2} className="glass-input" placeholder="e.g. Pays on the 1st of every month" value={form.notes} onChange={updateField("notes")} />
      </div>

      {error && <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</div>}

      <div className="review-actions">
        <button type="submit" className="glass-btn primary small" disabled={isSaving}>
          {isSaving && <Loader2 size={16} className="pulse" />} {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="glass-btn small" onClick={onCancel} disabled={isSaving}>Cancel</button>
        )}
      </div>
    </form>
  );
}
