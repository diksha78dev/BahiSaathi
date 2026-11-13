import { useState, useEffect } from "react";
import { PlusCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import apiClient from "../api/client";

const EMPTY_FORM = {
  customer_name: "",
  item_name: "",
  quantity: "",
  unit: "",
  amount: "",
  payment_status: "udhaar",
};

/** Turn a FastAPI error response into one readable line. */
function errorText(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

export default function ManualEntryForm({ onEntrySuccess, refreshTrigger }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Existing customers power the name suggestions and the name → id lookup
  useEffect(() => {
    apiClient
      .get("/customers/")
      .then((res) => setCustomers(res.data || []))
      .catch((err) => console.error("Failed to fetch customers", err));
  }, [refreshTrigger]);

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  /** Find the customer by name (case-insensitive), creating them if new. */
  const resolveCustomerId = async (rawName) => {
    const name = rawName.trim();
    if (!name) return null; // walk-in sale, no customer
    const existing = customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const res = await apiClient.post("/customers/", { name });
    setCustomers((prev) => [...prev, res.data]);
    return res.data.id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim() || !formData.amount) return;

    setLoading(true);
    setError("");
    try {
      const customer_id = await resolveCustomerId(formData.customer_name);
      await apiClient.post("/entries/manual", {
        customer_id,
        item_name: formData.item_name.trim(),
        quantity: formData.quantity ? parseFloat(formData.quantity) : null,
        unit: formData.unit.trim() || null,
        amount: parseFloat(formData.amount),
        payment_status: formData.payment_status,
      });
      setFormData(EMPTY_FORM);
      if (onEntrySuccess) onEntrySuccess();
    } catch (err) {
      console.error("Failed to add entry", err);
      setError(errorText(err, "Could not add entry. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card"
    >
      <h3 style={{ marginBottom: 20 }}>Manual Entry</h3>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label>Customer Name (Optional)</label>
          <input
            type="text"
            className="glass-input"
            placeholder="e.g. Ramesh Singh — leave blank for walk-in"
            list="customer-suggestions"
            value={formData.customer_name}
            onChange={update("customer_name")}
          />
          <datalist id="customer-suggestions">
            {customers.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>

        <div className="field-group">
          <label>Item</label>
          <input
            type="text"
            className="glass-input"
            placeholder="e.g. Sugar"
            value={formData.item_name}
            onChange={update("item_name")}
            required
          />
        </div>

        <div className="content-grid" style={{ gap: 16, gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label>Quantity (Optional)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="glass-input"
              placeholder="e.g. 2"
              value={formData.quantity}
              onChange={update("quantity")}
            />
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label>Unit (Optional)</label>
            <input
              type="text"
              className="glass-input"
              placeholder="kg, litre, piece"
              value={formData.unit}
              onChange={update("unit")}
            />
          </div>
        </div>

        <div className="content-grid" style={{ gap: 16, gridTemplateColumns: "1fr 1fr", marginBottom: 24 }}>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label>Amount (₹)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="glass-input"
              placeholder="0.00"
              value={formData.amount}
              onChange={update("amount")}
              required
            />
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label>Payment</label>
            <select
              className="glass-input"
              value={formData.payment_status}
              onChange={update("payment_status")}
            >
              <option value="udhaar">Udhaar (on credit)</option>
              <option value="paid">Paid (cash)</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>{error}</div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="glass-btn primary"
          disabled={loading}
        >
          {loading ? <Loader2 className="pulse" size={20} /> : <PlusCircle size={20} />}
          Add Entry
        </motion.button>
      </form>
    </motion.div>
  );
}
