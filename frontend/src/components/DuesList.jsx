/** Customers who owe money. Props: dues from GET /reports/dues */
import { motion } from "framer-motion";
import { AlertCircle, PartyPopper } from "lucide-react";
import { formatRupees } from "../utils/format";

export default function DuesList({ dues, isLoading }) {
  return (
    <div className="glass-card">
      <div className="header-flex">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={20} color="var(--danger)" /> Outstanding Dues
        </h3>
        <div className="text-secondary" style={{ fontSize: 13 }}>
          {dues.length} {dues.length === 1 ? "customer" : "customers"}
        </div>
      </div>

      {isLoading ? (
        <div className="text-secondary text-center" style={{ padding: 20 }}>Loading...</div>
      ) : dues.length === 0 ? (
        <div className="text-secondary text-center" style={{ padding: "40px 20px" }}>
          <PartyPopper size={48} opacity={0.2} color="var(--accent)" />
          <p style={{ margin: "12px 0 0" }}>All clear! No outstanding dues.</p>
        </div>
      ) : (
        <div className="list-container" style={{ maxHeight: 300 }}>
          {dues.map((customer, index) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index, 10) * 0.05 }}
              className="list-item udhaar-item"
            >
              <div className="item-left">
                <div className="item-name">{customer.name}</div>
                {customer.phone && <div className="item-sub">{customer.phone}</div>}
              </div>
              <div className="item-right">
                <div className="amount udhaar">{formatRupees(customer.total_dues)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
