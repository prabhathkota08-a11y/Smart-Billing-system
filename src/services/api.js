const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export function getToken() {
  return localStorage.getItem("authToken");
}

export function setToken(token) {
  localStorage.setItem("authToken", token);
}

export function clearToken() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("isAuthenticated");
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function loginUser(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email, password) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCustomers() {
  return apiFetch("/customers");
}

export async function createCustomer(customerData) {
  return apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify(customerData),
  });
}

export async function deleteCustomer(id) {
  return apiFetch(`/customers/${id}`, {
    method: "DELETE",
  });
}

export async function updateCustomer(id, customerData) {
  return apiFetch(`/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(customerData),
  });
}

export async function fetchInvoices() {
  return apiFetch("/invoices");
}

export async function createInvoice(invoiceData) {
  return apiFetch("/invoices", {
    method: "POST",
    body: JSON.stringify(invoiceData),
  });
}

export async function deleteInvoice(id) {
  return apiFetch(`/invoices/${id}`, {
    method: "DELETE",
  });
}

export async function updateInvoice(id, invoiceData) {
  return apiFetch(`/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(invoiceData),
  });
}

export async function fetchPayments() {
  return apiFetch("/payments");
}

export async function createPayment(paymentData) {
  return apiFetch("/payments", {
    method: "POST",
    body: JSON.stringify(paymentData),
  });
}

export async function deletePayment(id) {
  return apiFetch(`/payments/${id}`, {
    method: "DELETE",
  });
}

export async function updatePayment(id, paymentData) {
  return apiFetch(`/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify(paymentData),
  });
}

export async function sendEmailReminders(customerName) {
  return apiFetch("/reminders/email", {
    method: "POST",
    body: JSON.stringify(customerName ? { customerName } : {}),
  });
}

export async function sendSingleEmailReminder(payload) {
  return apiFetch("/reminders/email/single", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
