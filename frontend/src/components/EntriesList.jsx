/** Recent ledger entries. Props: entries from GET /entries/, onMarkPaid(entryId) */
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Inbox } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../api/client";
import { formatDate, formatQuantity, formatRupees } from "../utils/format";

export default function EntriesList({ entries, isLoading, onMarkPaid }) {
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");

  const handleMarkPaid = async (entryId) => {
    setPayingId(entryId);
    setError("");
    try {
      await onMarkPaid(entryId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't mark this entry as paid."));
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="glass-card">
      <div className="header-flex">
        <h3>Recent Entries</h3>
        <div className="text-secondary" style={{ fontSize: 13 }}>{entries.length} records</div>
      </div>

      {error && <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</div>}

      {isLoading ? (
        <div className="text-secondary text-center" style={{ padding: 20 }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-secondary text-center" style={{ padding: "40px 20px" }}>
          <Inbox size={48} opacity={0.2} />
          <p style={{ margin: "12px 0 0" }}>No entries yet. Add one manually or upload a scan!</p>
        </div>
      ) : (
        <div className="list-container">
          <AnimatePresence>
            {entries.map((entry, index) => {
              const isUdhaar = entry.payment_status === "udhaar";
              const quantity = formatQuantity(entry.quantity, entry.unit);
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index, 10) * 0.05 }}
                  className={`list-item ${isUdhaar ? "udhaar-item" : "paid-item"}`}
                >
                  <div className="item-left">
                    <div className="item-name">
                      {entry.item_name}
                      {quantity && <span className="text-secondary" style={{ fontWeight: 400 }}> · {quantity}</span>}
                    </div>
                    <div className="item-sub">
                      {entry.customer_name || "Walk-in"} • {formatDate(entry.transaction_date)}
                      {!entry.is_manual && " • AI scan"}
                    </div>
                  </div>
                  <div className="item-right">
                    <div className={`amount ${isUdhaar ? "udhaar" : "paid"}`}>{formatRupees(entry.amount)}</div>
                    {isUdhaar ? (
                      <button
                        className="glass-btn small"
                        onClick={() => handleMarkPaid(entry.id)}
                        disabled={payingId === entry.id}
                        title="Mark as paid"
                      >
                        <Check size={16} /> Mark Paid
                      </button>
                    ) : (
                      <CheckCircle2 size={20} color="var(--accent)" aria-label="Paid" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
