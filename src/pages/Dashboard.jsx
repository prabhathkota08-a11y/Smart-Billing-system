import { useState, useEffect } from "react";
import Layout from "../component/Layout";
import DashboardCard from "../component/DashboardCard";
import RevenueChart from "../component/RevenueChart";
import { getToken } from "../services/api";

const BASE_URL = "/api";

async function fetchStats() {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: "center", padding: "80px", color: "#94a3b8" }}>Loading dashboard...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div style={{ textAlign: "center", padding: "80px", color: "#dc2626" }}>{error}</div>
      </Layout>
    );
  }

  const chartData = [
    { name: "Revenue", revenue: stats?.totalRevenue || 0, pending: stats?.pendingAmount || 0 },
  ];

  return (
    <Layout>
      <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: "0 0 24px" }}>
        Dashboard
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        <DashboardCard title="Total Customers" value={stats?.totalCustomers || 0} icon="👥" color="#3b82f6" />
        <DashboardCard title="Total Invoices" value={stats?.totalInvoices || 0} icon="📄" color="#8b5cf6" />
        <DashboardCard title="Total Revenue" value={`₹${(stats?.totalRevenue || 0).toLocaleString("en-IN")}`} icon="💰" color="#10b981" />
        <DashboardCard title="Pending Amount" value={`₹${(stats?.pendingAmount || 0).toLocaleString("en-IN")}`} icon="⏳" color="#f59e0b" />
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", margin: "0 0 16px" }}>
          Revenue Overview
        </h2>
        <RevenueChart data={chartData} />
      </div>
    </Layout>
  );
}

export default Dashboard;
