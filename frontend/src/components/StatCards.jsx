/** The four headline numbers. Props: stats from GET /reports/dashboard */
import { motion } from "framer-motion";
import { ScanLine, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRupees } from "../utils/format";

/** Animates a number from 0 up to `target` */
function useCountUp(target, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease-out
      setValue(progress < 1 ? eased * target : target); // land exactly on the real value
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

const formatCount = (value) => Math.round(value).toLocaleString("en-IN");

function StatCard({ icon, label, value, format = formatCount, tone }) {
  const animated = useCountUp(value);
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      className="glass-card stat-item"
    >
      <div className="label">{icon} {label}</div>
      <div className={`value ${tone || ""}`}>{format(animated)}</div>
    </motion.div>
  );
}

export default function StatCards({ stats, isLoading }) {
  if (isLoading || !stats) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card stat-item pulse" style={{ height: 110 }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="stats-grid glass-card"
      style={{ padding: 24 }}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
    >
      <StatCard
        icon={<TrendingDown size={16} color="var(--danger)" />}
        label="Udhaar Outstanding"
        value={stats.total_udhaar}
        format={formatRupees}
        tone="danger"
      />
      <StatCard
        icon={<TrendingUp size={16} color="var(--accent)" />}
        label="Sales This Month"
        value={stats.total_sales_this_month}
        format={formatRupees}
        tone="success"
      />
      <StatCard icon={<Users size={16} />} label="Customers" value={stats.total_customers} />
      <StatCard icon={<ScanLine size={16} />} label="Scans This Month" value={stats.scans_this_month} />
    </motion.div>
  );
}
