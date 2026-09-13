import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Welcome back</p>
          <h1>{user?.shop_name}</h1>
        </div>
        <button className="btn-ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <section className="dashboard-card">
        <h2>Signed in as {user?.owner_name}</h2>
        <dl className="dashboard-meta">
          <div>
            <dt>Phone</dt>
            <dd>{user?.phone}</dd>
          </div>
          <div>
            <dt>Preferred language</dt>
            <dd>{user?.preferred_language?.toUpperCase()}</dd>
          </div>
        </dl>
      </section>

      <section className="dashboard-placeholder">
        <h3>Camera upload, entries and dues are coming in Module 6</h3>
        <p>
          This is where you'll photograph a bahi page, watch it turn into
          structured entries, and see today's udhaar at a glance.
        </p>
      </section>
    </div>
  );
}