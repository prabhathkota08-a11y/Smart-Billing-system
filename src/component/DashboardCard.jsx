function DashboardCard({ title, value, icon, color }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "12px",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      display: "flex",
      alignItems: "center",
      gap: "16px",
    }}>
      <div style={{
        width: "48px",
        height: "48px",
        borderRadius: "12px",
        background: color || "#3b82f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "14px", color: "#64748b" }}>{title}</div>
        <div style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b" }}>{value}</div>
      </div>
    </div>
  );
}

export default DashboardCard;
