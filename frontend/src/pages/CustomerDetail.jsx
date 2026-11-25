/**
 * One customer (/customers/:customerId) — their details, total dues and full ledger.
 *
 *   useCustomerDetail(id) ──► customer + entries (GET /entries/?customer_id=)
 *   Edit   ──► PATCH /customers/{id}      ──► reload()
 *   Mark paid ──► PATCH /entries/{id}/mark-paid ──► reload() (dues drop)
 *   Delete ──► DELETE /customers/{id} ──► back to the list
 *              (the backend refuses while dues > 0; its message is shown as-is)
 *
 * It's a route, not a pop-up, so refreshing or sharing the URL keeps you here.
 */
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { deleteCustomer, updateCustomer } from "../api/customers";
import { markEntryPaid } from "../api/entries";
import CustomerForm from "../components/CustomerForm";
import EntriesList from "../components/EntriesList";
import OverdueBadge from "../components/OverdueBadge";
import { useCustomerDetail } from "../hooks/useCustomers";
import { formatDate, formatRupees } from "../utils/format";

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { customer, entries, isLoading, error, reload } = useCustomerDetail(customerId);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleSave = async (changes) => {
    await updateCustomer(customerId, changes);
    setIsEditing(false);
    setDeleteError("");
    await reload();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${customer.name}? Their paid entries stay in your reports.`)) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteCustomer(customerId);
      navigate("/customers", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Couldn't delete this customer."));
      setIsDeleting(false);
    }
  };

  const handleMarkPaid = async (entryId) => {
    await markEntryPaid(entryId);
    setDeleteError(""); // a "still owes ₹X" message would be out of date now
    await reload();
  };

  const backLink = (
    <Link to="/customers" className="back-link">
      <ArrowLeft size={16} /> All customers
    </Link>
  );

  if (isLoading) {
    return <>{backLink}<div className="text-secondary">Loading...</div></>;
  }

  // Failed before we ever had the customer (wrong id, deleted, server down)
  if (!customer) {
    return (
      <>
        {backLink}
        <div className="glass-card" style={{ color: "var(--danger)" }}>
          {error}{" "}
          <button className="glass-btn small" onClick={reload}>Retry</button>
        </div>
      </>
    );
  }

  const unpaidCount = entries.filter((e) => e.payment_status === "udhaar").length;

  return (
    <>
      {backLink}

      {error && <div className="glass-card" style={{ color: "var(--danger)" }}>{error}</div>}

      <div className="glass-card">
        {isEditing ? (
          <>
            <h3>Edit customer</h3>
            <CustomerForm initial={customer} submitLabel="Save changes" onSubmit={handleSave} onCancel={() => setIsEditing(false)} />
          </>
        ) : (
          <div className="customer-header">
            <div>
              <h1 style={{ marginBottom: 6, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                {customer.name}
                {customer.is_overdue && <OverdueBadge oldestUnpaidDate={customer.oldest_unpaid_date} />}
              </h1>
              <p className="text-secondary">{customer.phone || "No phone"} · Customer since {formatDate(customer.created_at)}</p>
              {customer.notes && <p className="customer-notes">{customer.notes}</p>}
              <div className="review-actions" style={{ marginTop: 16 }}>
                <button className="glass-btn small" onClick={() => setIsEditing(true)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="glass-btn small danger" onClick={handleDelete} disabled={isDeleting}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
              {deleteError && <div style={{ color: "var(--danger)", fontSize: 14, marginTop: 12 }}>{deleteError}</div>}
            </div>

            <div className="stat-item" style={{ textAlign: "right" }}>
              <div className="label" style={{ justifyContent: "flex-end" }}>Total dues</div>
              <div className={`value ${customer.total_dues > 0 ? "danger" : "success"}`}>{formatRupees(customer.total_dues)}</div>
              <div className="text-secondary" style={{ fontSize: 12 }}>
                {unpaidCount} unpaid {unpaidCount === 1 ? "entry" : "entries"}
                {customer.oldest_unpaid_date && ` · oldest ${formatDate(customer.oldest_unpaid_date)}`}
              </div>
            </div>
          </div>
        )}
      </div>

      <EntriesList
        entries={entries}
        isLoading={false}
        onMarkPaid={handleMarkPaid}
        title="Ledger history"
        emptyText="No entries for this customer yet."
      />
    </>
  );
}
