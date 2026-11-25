/**
 * Customers page — everyone the shop sells to, with their calculated dues.
 *
 *   useCustomers() ──► customers ──► search + sort (here, in the browser) ──► list
 *   "Add customer" ──► POST /customers/ ──► reload()
 *   click a row ──► /customers/:id (CustomerDetail)
 *
 * Search and sort run in the browser: a kirana shop has tens or hundreds of
 * customers, all already loaded, so a round trip per keystroke would add nothing.
 */
import { motion } from "framer-motion";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { createCustomer } from "../api/customers";
import CustomerForm from "../components/CustomerForm";
import OverdueBadge from "../components/OverdueBadge";
import { useCustomers } from "../hooks/useCustomers";
import { formatRupees } from "../utils/format";

const SORTS = {
  dues: { label: "Highest dues first", compare: (a, b) => b.total_dues - a.total_dues || a.name.localeCompare(b.name) },
  name: { label: "Name (A–Z)", compare: (a, b) => a.name.localeCompare(b.name) },
};

export default function Customers() {
  const { customers, isLoading, error, reload } = useCustomers();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("dues");
  const [isAdding, setIsAdding] = useState(false);

  const query = search.trim().toLowerCase();
  const visible = customers
    .filter((c) => c.name.toLowerCase().includes(query) || (c.phone ?? "").includes(query))
    .sort(SORTS[sortBy].compare);

  const totalDues = customers.reduce((sum, c) => sum + c.total_dues, 0);
  const overdueCount = customers.filter((c) => c.is_overdue).length;

  const handleAdd = async (customer) => {
    await createCustomer(customer);
    setIsAdding(false);
    await reload();
  };

  return (
    <>
      <header className="header-flex" style={{ marginBottom: 0 }}>
        <div>
          <h1>Customers</h1>
          <p className="text-secondary">
            {customers.length} {customers.length === 1 ? "customer" : "customers"} · {formatRupees(totalDues)} owed
            {overdueCount > 0 && <span style={{ color: "#f59e0b" }}> · {overdueCount} overdue</span>}
          </p>
        </div>
        {!isAdding && (
          <button className="glass-btn primary small" onClick={() => setIsAdding(true)}>
            <UserPlus size={16} /> Add customer
          </button>
        )}
      </header>

      {isAdding && (
        <motion.div className="glass-card" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h3>New customer</h3>
          <CustomerForm submitLabel="Add customer" onSubmit={handleAdd} onCancel={() => setIsAdding(false)} />
        </motion.div>
      )}

      {error && (
        <div className="glass-card" style={{ color: "var(--danger)" }}>
          {error}{" "}
          <button className="glass-btn small" onClick={reload}>Retry</button>
        </div>
      )}

      <div className="glass-card">
        <div className="page-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              className="glass-input"
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search customers"
            />
          </div>
          <select className="glass-input sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort customers">
            {Object.entries(SORTS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="text-secondary text-center" style={{ padding: 20 }}>Loading...</div>
        ) : customers.length === 0 ? (
          <div className="text-secondary text-center" style={{ padding: "40px 20px" }}>
            <Users size={48} opacity={0.2} />
            <p style={{ margin: "12px 0 0" }}>No customers yet. Add one, or they'll appear as you add udhaar entries.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-secondary text-center" style={{ padding: 20 }}>No customer matches “{search}”.</div>
        ) : (
          <div className="list-container" style={{ maxHeight: "none", overflowX: "hidden" }}>
            {visible.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index, 10) * 0.03 }}
              >
                <Link
                  to={`/customers/${customer.id}`}
                  className={`list-item customer-row ${customer.total_dues > 0 ? "udhaar-item" : "paid-item"} ${customer.is_overdue ? "overdue-item" : ""}`}
                >
                  <div className="item-left">
                    <div className="item-name">
                      {customer.name}
                      {customer.is_overdue && <OverdueBadge oldestUnpaidDate={customer.oldest_unpaid_date} />}
                    </div>
                    <div className="item-sub">{customer.phone || "No phone"}</div>
                  </div>
                  <div className="item-right">
                    <div className={`amount ${customer.total_dues > 0 ? "udhaar" : "paid"}`}>
                      {customer.total_dues > 0 ? formatRupees(customer.total_dues) : "No dues"}
                    </div>
                    <ChevronRight size={18} className="text-secondary" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
