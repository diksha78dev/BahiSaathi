/**
 * Dashboard page — owns the data and the actions; the components only display.
 *
 *   useDashboardData() ──► stats, entries, dues, customers ──► components (props)
 *   component action (add / upload / mark paid) ──► API call ──► reload()
 */
import { motion } from "framer-motion";
import { addManualEntry, markEntryPaid, uploadScan } from "../api/entries";
import DuesList from "../components/DuesList";
import EntriesList from "../components/EntriesList";
import ManualEntryForm from "../components/ManualEntryForm";
import Sidebar from "../components/Sidebar";
import StatCards from "../components/StatCards";
import UploadZone from "../components/UploadZone";
import { useDashboardData } from "../hooks/useDashboardData";
import "../styles/dashboard.css";

const fadeIn = (delay) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay },
});

export default function Dashboard() {
  const { stats, entries, dues, customers, isLoading, error, reload } = useDashboardData();

  // Each action calls the API, then refreshes every panel. Errors are re-thrown
  // so the component that triggered the action can show them.
  const handleAddEntry = async (entry) => {
    await addManualEntry(entry);
    await reload();
  };

  const handleUpload = async (file) => {
    const scan = await uploadScan(file);
    await reload();
    return scan;
  };

  const handleMarkPaid = async (entryId) => {
    await markEntryPaid(entryId);
    await reload();
  };

  return (
    <div className="dark-dashboard">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      <Sidebar />

      <main className="main-content">
        <motion.header {...fadeIn(0)} style={{ marginBottom: 8 }}>
          <h1>Overview</h1>
          <p className="text-secondary">Track udhaar, payments and dues across your shop.</p>
        </motion.header>

        {error && (
          <div className="glass-card" style={{ color: "var(--danger)" }}>
            {error}{" "}
            <button className="glass-btn small" onClick={reload}>Retry</button>
          </div>
        )}

        <motion.div {...fadeIn(0.15)}>
          <StatCards stats={stats} isLoading={isLoading} />
        </motion.div>

        <motion.div className="content-grid" {...fadeIn(0.3)}>
          <div className="panel-col">
            <UploadZone onUpload={handleUpload} />
            <ManualEntryForm customers={customers} onSubmit={handleAddEntry} />
          </div>
          <div className="panel-col">
            <EntriesList entries={entries} isLoading={isLoading} onMarkPaid={handleMarkPaid} />
            <DuesList dues={dues} isLoading={isLoading} />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
