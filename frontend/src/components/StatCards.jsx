import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Users, ScanLine } from "lucide-react";
import { motion } from "framer-motion";
import apiClient from "../api/client";

function useCountUp(endValue) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (endValue === undefined || endValue === null) return;
    let startTimestamp = null;
    const duration = 1200;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 4);
      setValue(Math.floor(easeProgress * endValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setValue(endValue);
      }
    };
    window.requestAnimationFrame(step);
  }, [endValue]);

  return value;
}

export default function StatCards({ refreshTrigger }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get("/reports/dashboard");
        const data = res.data;
        setStats({
          udhaar: Math.round(data.total_udhaar || 0),
          sales: Math.round(data.total_sales_this_month || 0),
          customers: data.total_customers || 0,
          scans: data.scans_this_month || 0,
        });
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [refreshTrigger]);

  const animatedUdhaar = useCountUp(stats?.udhaar || 0);
  const animatedSales = useCountUp(stats?.sales || 0);
  const animatedCustomers = useCountUp(stats?.customers || 0);
  const animatedScans = useCountUp(stats?.scans || 0);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  if (loading) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card stat-item pulse" style={{ height: 110, background: 'rgba(255,255,255,0.03)' }}></div>
        ))}
      </div>
    );
  }

  return (
    <motion.div 
      className="stats-grid glass-card"
      variants={container}
      initial="hidden"
      animate="show"
      style={{ padding: '24px' }}
    >
      <motion.div variants={item} className="glass-card stat-item">
        <div className="label">
          <TrendingDown size={16} color="var(--danger)" /> Udhaar Outstanding
        </div>
        <div className="value danger">₹{animatedUdhaar.toLocaleString("en-IN")}</div>
      </motion.div>
      <motion.div variants={item} className="glass-card stat-item">
        <div className="label">
          <TrendingUp size={16} color="var(--accent)" /> Sales This Month
        </div>
        <div className="value success">₹{animatedSales.toLocaleString("en-IN")}</div>
      </motion.div>
      <motion.div variants={item} className="glass-card stat-item">
        <div className="label">
          <Users size={16} /> Customers
        </div>
        <div className="value">{animatedCustomers.toLocaleString()}</div>
      </motion.div>
      <motion.div variants={item} className="glass-card stat-item">
        <div className="label">
          <ScanLine size={16} /> Scans This Month
        </div>
        <div className="value">{animatedScans.toLocaleString()}</div>
      </motion.div>
    </motion.div>
  );
}
