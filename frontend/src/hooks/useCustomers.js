/**
 * Data for the Customers pages, same pattern as useDashboardData:
 * load on mount, expose reload() to call after any change.
 *
 *   useCustomers()            → every customer (with dues + overdue flag)
 *   useCustomerDetail(id)     → one customer + their ledger entries
 */
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import { getCustomer, getCustomers } from "../api/customers";
import { getEntries } from "../api/entries";

// One customer's whole history fits comfortably; the backend caps it at 500
const CUSTOMER_ENTRIES_LIMIT = 500;

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    return getCustomers()
      .then((list) => {
        setCustomers(list);
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your customers.")))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { customers, isLoading, error, reload };
}

export function useCustomerDetail(customerId) {
  const [data, setData] = useState({ customer: null, entries: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    return Promise.all([
      getCustomer(customerId),
      getEntries({ customer_id: customerId, limit: CUSTOMER_ENTRIES_LIMIT }),
    ])
      .then(([customer, entries]) => {
        setData({ customer, entries });
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load this customer.")))
      .finally(() => setIsLoading(false));
  }, [customerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, isLoading, error, reload };
}
