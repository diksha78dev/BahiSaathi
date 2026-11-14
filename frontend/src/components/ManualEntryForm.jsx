/**
 * Type in a ledger entry. Props: customers (for name suggestions), onSubmit(entry).
 * The backend matches customer_name to an existing customer or creates a new one;
 * leave it blank for a walk-in sale.
 */
import { motion } from "framer-motion";
import { Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../api/client";
import { EMPTY_ENTRY_FORM, formToEntry } from "../utils/entryForm";

export default function ManualEntryForm({ customers, onSubmit }) {
  const [form, setForm] = useState(EMPTY_ENTRY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await onSubmit(formToEntry(form));
      setForm(EMPTY_ENTRY_FORM);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add the entry."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: 20 }}>Manual Entry</h3>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="customer_name">Customer Name (Optional)</label>
          <input
            id="customer_name"
            className="glass-input"
            placeholder="e.g. Ramesh Singh — leave blank for walk-in"
            list="customer-suggestions"
            value={form.customer_name}
            onChange={updateField("customer_name")}
          />
          <datalist id="customer-suggestions">
            {customers.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>

        <div className="field-group">
          <label htmlFor="item_name">Item</label>
          <input id="item_name" className="glass-input" placeholder="e.g. Sugar" value={form.item_name} onChange={updateField("item_name")} required />
        </div>

        <div className="form-row">
          <div className="field-group">
            <label htmlFor="quantity">Quantity (Optional)</label>
            <input id="quantity" type="number" step="any" min="0" className="glass-input" placeholder="e.g. 2" value={form.quantity} onChange={updateField("quantity")} />
          </div>
          <div className="field-group">
            <label htmlFor="unit">Unit (Optional)</label>
            <input id="unit" className="glass-input" placeholder="kg, litre, piece" value={form.unit} onChange={updateField("unit")} />
          </div>
        </div>

        <div className="form-row">
          <div className="field-group">
            <label htmlFor="amount">Amount (₹)</label>
            <input id="amount" type="number" step="any" min="0.01" className="glass-input" placeholder="0.00" value={form.amount} onChange={updateField("amount")} required />
          </div>
          <div className="field-group">
            <label htmlFor="payment_status">Payment</label>
            <select id="payment_status" className="glass-input" value={form.payment_status} onChange={updateField("payment_status")}>
              <option value="udhaar">Udhaar (on credit)</option>
              <option value="paid">Paid (cash)</option>
            </select>
          </div>
        </div>

        {error && <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>{error}</div>}

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="glass-btn primary" disabled={isSaving}>
          {isSaving ? <Loader2 className="pulse" size={20} /> : <PlusCircle size={20} />}
          Add Entry
        </motion.button>
      </form>
    </div>
  );
}
