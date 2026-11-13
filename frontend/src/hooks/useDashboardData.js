/**
 * Loads everything the dashboard shows, in parallel, and exposes reload().
 *
 * Data flow: Dashboard page calls this hook → passes data down to the
 * components as props → after any change (new entry, scan, mark paid)
 * the page calls reload() so every panel refreshes together.
 */
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import { getCustomers } from "../api/customers";
import { getEntries } from "../api/entries";
import { getDashboardStats, getDues } from "../api/reports";

export function useDashboardData() {
  const [data, setData] = useState({ stats: null, entries: [], dues: [], customers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    return Promise.all([getDashboardStats(), getEntries(), getDues(), getCustomers()])
      .then(([stats, entries, dues, customers]) => {
        setData({ stats, entries, dues, customers });
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your dashboard.")))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, isLoading, error, reload };
}
