import { useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import StatCards from "../components/StatCards";
import UploadZone from "../components/UploadZone";
import ManualEntryForm from "../components/ManualEntryForm";
import EntriesList from "../components/EntriesList";
import DuesList from "../components/DuesList";
import { motion } from "framer-motion";
import "../styles/dashboard.css";

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="dark-dashboard">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      
      <Sidebar />
      
      <main className="main-content">
        <motion.header 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          style={{ marginBottom: '8px' }}
        >
          <h1>Overview</h1>
          <p className="text-secondary">
            Monitor your daily udhaar and jama entries in real-time.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <StatCards refreshTrigger={refreshKey} />
        </motion.div>
        
        <motion.div 
          className="content-grid"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="panel-col">
            <UploadZone onUploadSuccess={triggerRefresh} />
            <ManualEntryForm onEntrySuccess={triggerRefresh} refreshTrigger={refreshKey} />
          </div>
          <div className="panel-col">
            <EntriesList refreshTrigger={refreshKey} onEntryUpdated={triggerRefresh} />
            <DuesList refreshTrigger={refreshKey} />
          </div>
        </motion.div>
      </main>
    </div>
  );
}