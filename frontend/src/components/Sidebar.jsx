import { LayoutDashboard, Users, FileText, Settings, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar glass-card">
      <div className="brand">
        <div className="avatar" style={{ width: 32, height: 32, fontSize: 16 }}>
          B
        </div>
        <span className="brand-text">BahiSaathi AI</span>
      </div>

      <nav className="nav-links">
        <button className="nav-item active">
          <LayoutDashboard size={20} />
          Dashboard
        </button>
        <button className="nav-item">
          <Users size={20} />
          Customers
        </button>
        <button className="nav-item">
          <FileText size={20} />
          Reports
        </button>
        <button className="nav-item">
          <Settings size={20} />
          Settings
        </button>
      </nav>

      <div className="user-profile">
        <div className="avatar" style={{ position: 'relative' }}>
          {user?.shop_name?.charAt(0).toUpperCase() || 'U'}
          <span className="online-indicator"></span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user?.shop_name || 'My Shop'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {user?.owner_name || 'Owner'}
          </div>
        </div>
        <button 
          onClick={logout} 
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          title="Log out"
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
