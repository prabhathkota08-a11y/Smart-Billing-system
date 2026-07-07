import { useState, useEffect } from "react";
import Layout from "../component/Layout";
import CustomerForm from "../component/CustomerForm";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from "../services/api";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetchCustomers()
      .then(setCustomers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await createCustomer(data);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (data) => {
    try {
      await updateCustomer(editing.id, data);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteCustomer(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = customers.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: 0 }}>Customers</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); }} style={addBtnStyle}>
          + Add Customer
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {showForm && (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>New Customer</h3>
          <CustomerForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editing && (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>Edit Customer</h3>
          <CustomerForm onSubmit={handleUpdate} initialData={editing} onCancel={() => setEditing(null)} />
        </div>
      )}

      <input
        type="text"
        placeholder="Search customers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0",
          borderRadius: "8px", marginBottom: "16px", boxSizing: "border-box", outline: "none",
        }}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
          {search ? "No customers match your search." : "No customers yet. Add your first customer!"}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.phone}</td>
                  <td style={tdStyle}>{c.email}</td>
                  <td style={tdStyle}>
                    <button onClick={() => setEditing(c)} style={editBtnStyle}>Edit</button>
                    <button onClick={() => handleDelete(c.id)} style={delBtnStyle}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

const thStyle = { padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" };
const tdStyle = { padding: "12px 16px", fontSize: "14px", color: "#475569" };
const addBtnStyle = { padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" };
const editBtnStyle = { padding: "6px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", marginRight: "8px", fontSize: "12px" };
const delBtnStyle = { padding: "6px 14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontSize: "12px" };

export default Customers;
