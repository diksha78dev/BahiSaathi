/**
 * The frame every logged-in page sits in: background orbs + sidebar on the
 * left, and the current page (<Outlet />) on the right.
 *
 * App.jsx nests the protected routes under this layout, so the sidebar is
 * rendered once and stays put while only the page area changes.
 */
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../styles/dashboard.css";

export default function AppLayout() {
  return (
    <div className="dark-dashboard">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      <Sidebar />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
