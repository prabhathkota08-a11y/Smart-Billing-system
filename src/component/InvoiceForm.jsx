import { useState, useEffect } from "react";
import { fetchCustomers } from "../services/api";

function InvoiceForm({ onSubmit, initialData, onCancel }) {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    onSubmit({
      customer: form.get("customer"),
      amount: form.get("amount"),
      status: form.get("status") || "Pending",
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <select
        name="customer"
        defaultValue={initialData?.customer || ""}
        required
        style={inputStyle}
      >
        <option value="">Select Customer</option>
        {customers.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
      <input
        name="amount"
        type="number"
        step="0.01"
        defaultValue={initialData?.amount || ""}
        placeholder="Amount (₹)"
        required
        style={inputStyle}
      />
      <select
        name="status"
        defaultValue={initialData?.status || "Pending"}
        style={inputStyle}
      >
        <option value="Pending">Pending</option>
        <option value="Paid">Paid</option>
      </select>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={btnSecondaryStyle}>
            Cancel
          </button>
        )}
        <button type="submit" style={btnPrimaryStyle}>
          {initialData ? "Update" : "Create"} Invoice
        </button>
      </div>
    </form>
  );
}

const inputStyle = {
  padding: "10px 14px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
};

const btnPrimaryStyle = {
  padding: "10px 20px",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
};

const btnSecondaryStyle = {
  padding: "10px 20px",
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
};

export default InvoiceForm;
