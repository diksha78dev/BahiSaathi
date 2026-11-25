/**
 * Dashboard page (inside AppLayout) — owns the data and the actions; the components only display.
 *
 *   useDashboardData() ──► stats, entries, dues, customers ──► components (props)
 *   component action (add / confirm scan / mark paid) ──► API call ──► reload()
 *
 * Scanning is two steps: upload → the AI's draft is held here (draftScan) and
 * shown in <ScanReview> → only "Save" writes it to the ledger.
 */
import { motion } from "framer-motion";
import { useState } from "react";
import { addManualEntry, confirmScan, discardScan, markEntryPaid, uploadScan } from "../api/entries";
import DuesList from "../components/DuesList";
import EntriesList from "../components/EntriesList";
import ManualEntryForm from "../components/ManualEntryForm";
import ScanReview from "../components/ScanReview";
import StatCards from "../components/StatCards";
import UploadZone from "../components/UploadZone";
import { useDashboardData } from "../hooks/useDashboardData";

const fadeIn = (delay) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay },
});

export default function Dashboard() {
  const { stats, entries, dues, customers, isLoading, error, reload } = useDashboardData();
  const [draftScan, setDraftScan] = useState(null); // AI result waiting for review

  // Each action calls the API, then refreshes every panel. Errors are re-thrown
  // so the component that triggered the action can show them.
  const handleAddEntry = async (entry) => {
    await addManualEntry(entry);
    await reload();
  };

  // Upload only produces a draft — nothing is in the ledger yet, so no reload
  const handleUpload = async (file) => {
    const scan = await uploadScan(file);
    if (scan.status === "needs_review") {
      if (scan.extracted_entries.length > 0) setDraftScan(scan);
      else await discardScan(scan.id); // nothing to review — close it
    }
    return scan;
  };

  const handleConfirmScan = async (reviewedEntries) => {
    await confirmScan(draftScan.id, reviewedEntries);
    setDraftScan(null);
    await reload();
  };

  const handleDiscardScan = async () => {
    await discardScan(draftScan.id);
    setDraftScan(null);
  };

  const handleMarkPaid = async (entryId) => {
    await markEntryPaid(entryId);
    await reload();
  };

  return (
    <>
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

      {draftScan && (
        <ScanReview
          key={draftScan.id}
          scan={draftScan}
          customers={customers}
          onConfirm={handleConfirmScan}
          onDiscard={handleDiscardScan}
        />
      )}

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
    </>
  );
}
