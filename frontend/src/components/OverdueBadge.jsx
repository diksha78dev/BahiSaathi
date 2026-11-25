/**
 * Amber "Overdue · 45 days" tag. Props: oldestUnpaidDate (ISO date).
 * Whether a customer IS overdue is decided by the backend (is_overdue, using
 * OVERDUE_AFTER_DAYS); this only shows how long the oldest udhaar has been open.
 */
import { Clock } from "lucide-react";
import { daysSince } from "../utils/format";

export default function OverdueBadge({ oldestUnpaidDate }) {
  const days = daysSince(oldestUnpaidDate);
  return (
    <span className="overdue-badge" title={`Oldest unpaid entry is ${days} days old`}>
      <Clock size={12} /> Overdue · {days} days
    </span>
  );
}
