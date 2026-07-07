import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../services/api";
import "./Slidebar.css";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/customers", label: "Customers", icon: "👥" },
  { path: "/invoices",  label: "Invoices",  icon: "📄" },
  { path: "/payments",  label: "Payments",  icon: "💰" },
  { path: "/ai-assistant", label: "AI Assistant", icon: "🤖" },
];

function Slidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">$</div>
        <h2>Smart Billing</h2>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Slidebar;
