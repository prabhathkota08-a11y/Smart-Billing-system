import { useState, useEffect } from "react";
import Layout from "../component/Layout";
import InvoiceForm from "../component/InvoiceForm";
import { fetchInvoices, createInvoice, updateInvoice, deleteInvoice, sendSingleEmailReminder } from "../services/api";

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetchInvoices()
      .then(setInvoices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await createInvoice(data);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (data) => {
    try {
      await updateInvoice(editing.id, data);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteInvoice(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendReminder = async (inv) => {
    try {
      await sendSingleEmailReminder({
        email: inv.customerEmail || "",
        customerName: inv.customer,
        invoiceNo: inv.invoiceNo,
        amount: inv.amount,
      });
      alert("Reminder sent!");
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = invoices.filter((inv) =>
    !search || inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer?.toLowerCase().includes(search.toLowerCase()) ||
    inv.status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: 0 }}>Invoices</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); }} style={addBtnStyle}>
          + Create Invoice
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {showForm && (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>New Invoice</h3>
          <InvoiceForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editing && (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>Edit Invoice</h3>
          <InvoiceForm onSubmit={handleUpdate} initialData={editing} onCancel={() => setEditing(null)} />
        </div>
      )}

      <input
        type="text"
        placeholder="Search invoices..."
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
          {search ? "No invoices match your search." : "No invoices yet. Create your first invoice!"}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={thStyle}>Invoice No</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{inv.invoiceNo}</td>
                  <td style={tdStyle}>{inv.customer}</td>
                  <td style={tdStyle}>₹{Number(inv.amount).toLocaleString("en-IN")}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: inv.status === "Paid" ? "#dcfce7" : "#fef3c7",
                      color: inv.status === "Paid" ? "#16a34a" : "#d97706",
                      padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "700",
                    }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => setEditing(inv)} style={editBtnStyle}>Edit</button>
                    <button onClick={() => handleDelete(inv.id)} style={delBtnStyle}>Delete</button>
                    {inv.status === "Pending" && (
                      <button onClick={() => handleSendReminder(inv)} style={remindBtnStyle}>Remind</button>
                    )}
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
const editBtnStyle = { padding: "6px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", marginRight: "4px", fontSize: "12px" };
const delBtnStyle = { padding: "6px 14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", marginRight: "4px", fontSize: "12px" };
const remindBtnStyle = { padding: "6px 14px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "6px", cursor: "pointer", fontSize: "12px" };

export default Invoices;
