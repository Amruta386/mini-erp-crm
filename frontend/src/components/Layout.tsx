import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Mini ERP + CRM</h1>
        <nav>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => (isActive ? "active" : "")}>
            Customers
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => (isActive ? "active" : "")}>
            Products &amp; Stock
          </NavLink>
          <NavLink to="/challans" className={({ isActive }) => (isActive ? "active" : "")}>
            Sales Challans
          </NavLink>
        </nav>
        <div className="role-badge">
          Signed in as {user?.name} ({user?.role})
        </div>
        <div className="logout">
          <button className="btn btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
