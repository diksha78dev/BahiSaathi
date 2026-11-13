import { useState, useEffect } from "react";
import { Check, CheckCircle2, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../api/client";

export default function EntriesList({ refreshTrigger, onEntryUpdated }) {
  const [entries, setEntries] = useState([]);
  const [customerNames, setCustomerNames] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        // Entries only carry customer_id, so fetch customers to show names
        const [entriesRes, customersRes] = await Promise.all([
          apiClient.get("/entries/"),
          apiClient.get("/customers/"),
        ]);
        setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
        setCustomerNames(
          Object.fromEntries((customersRes.data || []).map((c) => [c.id, c.name]))
        );
      } catch (err) {
        console.error("Failed to fetch entries", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [refreshTrigger]);

  const handleMarkPaid = async (id) => {
    try {
      const res = await apiClient.patch(`/entries/${id}/mark-paid`);
      setEntries((prev) => prev.map((e) => (e.id === id ? res.data : e)));
      if (onEntryUpdated) onEntryUpdated();
    } catch (err) {
      console.error("Failed to mark as paid", err);
    }
  };


  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card"
    >
      <div className="header-flex">
        <h3>Recent Entries</h3>
        <div className="text-secondary" style={{ fontSize: 13 }}>{entries.length} records</div>
      </div>
      
      {loading ? (
        <div className="text-secondary text-center" style={{ padding: 20 }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-secondary text-center" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5, delay: 0.4 }}
          >
            <Inbox size={48} opacity={0.2} />
          </motion.div>
          <p style={{ margin: 0 }}>No entries yet. Add one manually or upload a scan!</p>
        </div>
      ) : (
        <div className="list-container">
          <AnimatePresence>
            {entries.map((entry, index) => {
              const isUdhaar = entry.payment_status === "udhaar";
              const customer = customerNames[entry.customer_id] || "Walk-in";
              const qty = entry.quantity ? `${entry.quantity}${entry.unit ? " " + entry.unit : ""}` : "";
              const date = entry.transaction_date || entry.created_at;
              return (
              <motion.div 
                key={entry.id} 
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                layout
                className={`list-item ${isUdhaar ? 'udhaar-item' : 'jama-item'}`}
              >
                <div className="item-left">
                  <div className="item-name">
                    {entry.item_name}
                    {qty && <span className="text-secondary" style={{ fontWeight: 400 }}> · {qty}</span>}
                  </div>
                  <div className="item-sub">
                    {customer}
                    {date && ` • ${new Date(date).toLocaleDateString("en-IN")}`}
                    {!entry.is_manual && " • AI scan"}
                  </div>
                </div>
                <div className="item-right">
                  <div className={`amount ${isUdhaar ? 'udhaar' : 'jama'}`}>
                    ₹{Number(entry.amount).toLocaleString("en-IN")}
                  </div>
                  {isUdhaar && (
                    <button 
                      className="glass-btn small"
                      onClick={() => handleMarkPaid(entry.id)}
                      title="Mark as paid"
                    >
                      <Check size={16} /> Mark Paid
                    </button>
                  )}
                  {!isUdhaar && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <CheckCircle2 size={20} color="var(--accent)" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
