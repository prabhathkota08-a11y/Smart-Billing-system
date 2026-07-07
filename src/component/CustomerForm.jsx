function CustomerForm({ onSubmit, initialData, onCancel }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    onSubmit({
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input
        name="name"
        defaultValue={initialData?.name || ""}
        placeholder="Customer Name"
        required
        style={inputStyle}
      />
      <input
        name="phone"
        defaultValue={initialData?.phone || ""}
        placeholder="Phone Number"
        required
        style={inputStyle}
      />
      <input
        name="email"
        type="email"
        defaultValue={initialData?.email || ""}
        placeholder="Email Address"
        required
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={btnSecondaryStyle}>
            Cancel
          </button>
        )}
        <button type="submit" style={btnPrimaryStyle}>
          {initialData ? "Update" : "Add"} Customer
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

export default CustomerForm;
