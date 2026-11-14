/**
 * Review what the AI read before anything is saved.
 *
 * Props:
 *   scan       — the scan from POST /entries/upload-scan (status "needs_review")
 *   customers  — existing customers, suggested in the name field so "Suresh"
 *                and "सुरेश" can be pointed at the same person
 *   onConfirm(entries) — save these lines to the ledger
 *   onDiscard()        — throw the draft away
 *
 * Every field is editable, lines can be removed or added, and lines the AI was
 * unsure about are highlighted so the shopkeeper checks those first.
 */
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../api/client";
import { EMPTY_ENTRY_FORM, entryToForm, formToEntry, isEntryFormValid } from "../utils/entryForm";
import { formatRupees } from "../utils/format";

// Lines the AI was less sure about than this get a "Check" highlight
const LOW_CONFIDENCE = 0.85;

let nextRowKey = 0;
const newRow = (form, confidence = null) => ({ key: nextRowKey++, form, confidence });

export default function ScanReview({ scan, customers, onConfirm, onDiscard }) {
  const [rows, setRows] = useState(() =>
    scan.extracted_entries.map((entry) => newRow(entryToForm(entry), entry.confidence)),
  );
  const [busyAction, setBusyAction] = useState(null); // "save" | "discard" | null
  const [error, setError] = useState("");

  const updateField = (key, field) => (e) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, form: { ...row.form, [field]: e.target.value } } : row)));
  const removeRow = (key) => setRows(rows.filter((row) => row.key !== key));
  const addRow = () => setRows([...rows, newRow(EMPTY_ENTRY_FORM)]);

  const allValid = rows.length > 0 && rows.every((row) => isEntryFormValid(row.form));
  const total = (status) =>
    rows.filter((row) => row.form.payment_status === status).reduce((sum, row) => sum + (Number(row.form.amount) || 0), 0);
  const unsureCount = rows.filter((row) => row.confidence !== null && row.confidence < LOW_CONFIDENCE).length;

  const run = async (action, task) => {
    setBusyAction(action);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(getErrorMessage(err, action === "save" ? "Couldn't save these entries." : "Couldn't discard the scan."));
      setBusyAction(null);
    }
  };

  const handleSave = () =>
    run("save", () => onConfirm(rows.map((row) => ({ ...formToEntry(row.form), confidence: row.confidence }))));
  const handleDiscard = () => run("discard", onDiscard);

  return (
    <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="header-flex" style={{ marginBottom: 8 }}>
        <h3>Review scanned entries</h3>
        <button className="icon-btn" onClick={handleDiscard} disabled={busyAction !== null} title="Discard this scan">
          <X size={20} />
        </button>
      </div>
      <p className="text-secondary" style={{ marginBottom: 16 }}>
        Nothing is saved yet. Check each line against your bahi, fix anything wrong, then save.
        {unsureCount > 0 && (
          <span className="review-warning">
            <AlertTriangle size={14} /> {unsureCount} {unsureCount === 1 ? "line needs" : "lines need"} a closer look
          </span>
        )}
      </p>

      <datalist id="review-customer-suggestions">
        {customers.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>

      <div className="review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Amount (₹)</th>
              <th>Date</th>
              <th>Payment</th>
              <th aria-label="Remove line" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, form, confidence }) => {
              const isUnsure = confidence !== null && confidence < LOW_CONFIDENCE;
              return (
                <tr key={key} className={isUnsure ? "low-confidence" : ""}>
                  <td>
                    <input className="glass-input" list="review-customer-suggestions" placeholder="Walk-in"
                      value={form.customer_name} onChange={updateField(key, "customer_name")} aria-label="Customer" />
                  </td>
                  <td>
                    <input className={`glass-input ${form.item_name.trim() ? "" : "input-invalid"}`}
                      value={form.item_name} onChange={updateField(key, "item_name")} aria-label="Item" />
                    {isUnsure && (
                      <span className="confidence-hint" title={`AI was ${Math.round(confidence * 100)}% sure`}>
                        Check · {Math.round(confidence * 100)}%
                      </span>
                    )}
                  </td>
                  <td>
                    <input className="glass-input narrow" type="number" step="any" min="0"
                      value={form.quantity} onChange={updateField(key, "quantity")} aria-label="Quantity" />
                  </td>
                  <td>
                    <input className="glass-input narrow" value={form.unit} onChange={updateField(key, "unit")} aria-label="Unit" />
                  </td>
                  <td>
                    <input className={`glass-input narrow ${Number(form.amount) > 0 ? "" : "input-invalid"}`}
                      type="number" step="any" min="0.01"
                      value={form.amount} onChange={updateField(key, "amount")} aria-label="Amount" />
                  </td>
                  <td>
                    <input className="glass-input" type="date" value={form.transaction_date}
                      onChange={updateField(key, "transaction_date")} aria-label="Date (blank = today)" title="Blank = today" />
                  </td>
                  <td>
                    <select className="glass-input" value={form.payment_status} onChange={updateField(key, "payment_status")} aria-label="Payment">
                      <option value="udhaar">Udhaar</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => removeRow(key)} title="Remove this line" aria-label="Remove this line">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className="glass-btn small" onClick={addRow} style={{ marginTop: 12 }}>
        <Plus size={16} /> Add a missed line
      </button>

      <div className="review-footer">
        <div className="text-secondary">
          {rows.length} {rows.length === 1 ? "line" : "lines"} ·{" "}
          <span className="amount udhaar">{formatRupees(total("udhaar"))} udhaar</span> ·{" "}
          <span className="amount paid">{formatRupees(total("paid"))} paid</span>
        </div>
        <div className="review-actions">
          <button className="glass-btn small" onClick={handleDiscard} disabled={busyAction !== null}>
            {busyAction === "discard" ? <Loader2 className="pulse" size={16} /> : <X size={16} />} Discard
          </button>
          <button className="glass-btn primary small" onClick={handleSave} disabled={!allValid || busyAction !== null}>
            {busyAction === "save" ? <Loader2 className="pulse" size={16} /> : <CheckCircle size={16} />}
            Save {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </button>
        </div>
      </div>

      {!allValid && rows.length > 0 && (
        <div className="text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
          Every line needs an item and an amount above ₹0 (highlighted in red).
        </div>
      )}
      {error && <div style={{ color: "var(--danger)", fontSize: 14, marginTop: 12 }}>{error}</div>}
    </motion.div>
  );
}
