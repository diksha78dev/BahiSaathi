import { useState, useEffect } from "react";
import { AlertCircle, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../api/client";

export default function DuesList({ refreshTrigger }) {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDues = async () => {
      try {
        const res = await apiClient.get("/reports/dues");
        const data = res.data;
        setDues(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch dues", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDues();
  }, [refreshTrigger]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, x: 20 },
    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card"
    >
      <div className="header-flex">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={20} color="var(--danger)" /> 
          Outstanding Dues
        </h3>
        <div className="text-secondary" style={{ fontSize: 13 }}>{dues.length} customers</div>
      </div>
      
      {loading ? (
        <div className="text-secondary text-center" style={{ padding: 20 }}>Loading...</div>
      ) : dues.length === 0 ? (
        <div className="text-secondary text-center" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5, delay: 0.5 }}
          >
            <PartyPopper size={48} opacity={0.2} color="var(--accent)" />
          </motion.div>
          <p style={{ margin: 0 }}>All clear! No outstanding dues.</p>
        </div>
      ) : (
        <motion.div 
          className="list-container" 
          style={{ maxHeight: 300 }}
          variants={container}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence>
            {dues.map((due, idx) => (
              <motion.div 
                key={due.id || idx} 
                variants={item}
                layout
                className="list-item udhaar-item"
              >
                <div className="item-left">
                  <div className="item-name">{due.name}</div>
                </div>
                <div className="item-right">
                  <div className="amount udhaar">₹{Number(due.total_dues).toLocaleString("en-IN")}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}
