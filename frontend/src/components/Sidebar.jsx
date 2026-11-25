/**
 * Left navigation + logged-in shop.
 * Each item links to a route; NavLink marks the one matching the URL as active.
 * Set `ready: true` when a page is built — until then it shows "Soon" and can't be clicked.
 */
import { FileText, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, ready: true },
  { label: "Customers", path: "/customers", icon: Users, ready: true },
  { label: "Reports", path: "/reports", icon: FileText, ready: false },
  { label: "Settings", path: "/settings", icon: Settings, ready: false },
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
        {NAV_ITEMS.map(({ label, path, icon: Icon, ready }) =>
          ready ? (
            // NavLink adds "active" for /customers and also /customers/123
            <NavLink key={label} to={path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={20} />
              {label}
            </NavLink>
          ) : (
            <button key={label} className="nav-item" disabled title={`${label} — coming soon`}>
              <Icon size={20} />
              {label}
              <span className="soon-badge">Soon</span>
            </button>
          )
        )}
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
