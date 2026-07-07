import { useState, useEffect } from "react";
import { fetchInvoices } from "../services/api";

function PaymentForm({ onSubmit, initialData, onCancel }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices()
      .then(setInvoices)
      .catch(() => {});
  }, []);

  const handleInvoiceChange = (e) => {
    const inv = invoices.find((i) => i.invoiceNo === e.target.value);
    setSelectedInvoice(inv || null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    onSubmit({
      invoiceNo: form.get("invoiceNo"),
      amount: form.get("amount"),
      method: form.get("method") || "Cash",
      status: "Paid",
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <select
        name="invoiceNo"
        defaultValue={initialData?.invoiceNo || ""}
        onChange={handleInvoiceChange}
        required
        style={inputStyle}
      >
        <option value="">Select Invoice</option>
        {invoices.map((inv) => (
          <option key={inv.id} value={inv.invoiceNo}>
            {inv.invoiceNo} - {inv.customer} (₹{inv.amount})
          </option>
        ))}
      </select>
      <input
        name="amount"
        type="number"
        step="0.01"
        defaultValue={initialData?.amount || selectedInvoice?.amount || ""}
        placeholder="Amount (₹)"
        required
        style={inputStyle}
      />
      <select name="method" defaultValue={initialData?.method || "Cash"} style={inputStyle}>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="UPI">UPI</option>
        <option value="Bank Transfer">Bank Transfer</option>
      </select>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={btnSecondaryStyle}>
            Cancel
          </button>
        )}
        <button type="submit" style={btnPrimaryStyle}>
          Record Payment
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

export default PaymentForm;
