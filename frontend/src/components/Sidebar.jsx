/** Left navigation + logged-in shop. Customers/Reports/Settings pages arrive in Module 7. */
import { FileText, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, ready: true },
  { label: "Customers", icon: Users, ready: false },
  { label: "Reports", icon: FileText, ready: false },
  { label: "Settings", icon: Settings, ready: false },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar glass-card">
      <div className="brand">
        <div className="avatar" style={{ width: 32, height: 32, fontSize: 16 }}>B</div>
        <span className="brand-text">BahiSaathi AI</span>
      </div>

      <nav className="nav-links">
        {NAV_ITEMS.map(({ label, icon: Icon, ready }) => (
          <button
            key={label}
            className={`nav-item ${label === "Dashboard" ? "active" : ""}`}
            disabled={!ready}
            title={ready ? label : `${label} — coming soon`}
          >
            <Icon size={20} />
            {label}
            {!ready && <span className="soon-badge">Soon</span>}
          </button>
        ))}
      </nav>

      <div className="user-profile">
        <div className="avatar">{user.shop_name.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div className="profile-name">{user.shop_name}</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>{user.owner_name}</div>
        </div>
        <button onClick={logout} className="icon-btn" title="Log out" aria-label="Log out">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
