const express    = require("express");
const cors       = require("cors");
const fs         = require("fs");
const path       = require("path");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mongoose   = require("mongoose");
require("dotenv").config();

const app      = express();
const PORT     = process.env.PORT || 5000;
const JWT_SECRET    = process.env.JWT_SECRET    || "dev_jwt_secret_change_in_prod";
const MONGODB_URI   = process.env.MONGODB_URI   || "mongodb://localhost:27017/smartbilling";
const DIST_DIR      = path.join(__dirname, "..", "dist");
const REMINDER_EMAIL    = process.env.REMINDER_EMAIL          || "";
const REMINDER_EMAIL_PW = process.env.REMINDER_EMAIL_PASSWORD || "";

let dbConnected = false;
let usingEmbeddedDB = false;

async function startEmbeddedMongoDB() {
  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create({
      instance: { dbName: "smartbilling" },
    });
    const uri = mongod.getUri();
    console.log("Embedded MongoDB started at", uri);
    await mongoose.connect(uri);
    dbConnected = true;
    usingEmbeddedDB = true;
    console.log("Connected to embedded MongoDB");
    await seedAdmin();
    return;
  } catch (err) {
    throw err;
  }
}

async function connectWithRetry() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      dbConnected = true;
      console.log("Connected to MongoDB Atlas");
      await seedAdmin();
      return;
    } catch (err) {
      console.error("MongoDB Atlas connection failed:", err.message);
      console.log("Falling back to embedded MongoDB...");
    }
  } else {
    console.log("No MONGODB_URI set, starting embedded MongoDB...");
  }
  try {
    await startEmbeddedMongoDB();
  } catch (err) {
    dbConnected = false;
    console.error("Embedded MongoDB also failed:", err.message);
    console.error("Retrying in 10 seconds...");
    setTimeout(connectWithRetry, 10000);
  }
}

mongoose.connection.on("disconnected", async () => {
  dbConnected = false;
  if (usingEmbeddedDB) {
    console.error("Embedded MongoDB disconnected. Reconnecting...");
    setTimeout(connectWithRetry, 5000);
  } else {
    console.error("MongoDB disconnected. Reconnecting...");
    setTimeout(connectWithRetry, 5000);
  }
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
});

function requireDB(req, res, next) {
  if (!dbConnected) {
    return res.status(503).json({
      error: "Database is still starting up. Please wait a moment and refresh.",
      hint: "The server is starting an embedded database automatically.",
    });
  }
  next();
}

const userSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, default: "user" },
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name:   { type: String, required: true },
  phone:  { type: String, required: true },
  email:  { type: String, required: true },
}, { timestamps: true });

const invoiceSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  invoiceNo: { type: String, required: true },
  customer:  { type: String, required: true },
  amount:    { type: Number, required: true },
  status:    { type: String, default: "Pending" },
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  paymentId: { type: String, required: true },
  invoiceNo: { type: String, required: true },
  amount:    { type: Number, required: true },
  method:    { type: String, default: "Cash" },
  status:    { type: String, default: "Paid" },
}, { timestamps: true });

const User     = mongoose.model("User",     userSchema);
const Customer = mongoose.model("Customer", customerSchema);
const Invoice  = mongoose.model("Invoice",  invoiceSchema);
const Payment  = mongoose.model("Payment",  paymentSchema);

async function seedAdmin() {
  try {
    const exists = await User.findOne({ email: "admin@smartbilling.com" });
    if (!exists) {
      await User.create({
        email:    "admin@smartbilling.com",
        password: bcrypt.hashSync("admin123", 10),
        role:     "admin",
      });
      console.log("Default admin user seeded (admin@smartbilling.com / admin123)");
    }
  } catch (err) {
    console.error("Seed error:", err.message);
  }
}

if (!process.env.NODE_ENV && fs.existsSync(DIST_DIR)) {
  process.env.NODE_ENV = "production";
}
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5000",
].filter(Boolean);

app.use(cors({
  origin: isProduction ? true : allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  requireDB(req, res, next);
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token." });
  }
}

function createMailTransporter() {
  if (!REMINDER_EMAIL || !REMINDER_EMAIL_PW) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user: REMINDER_EMAIL, pass: REMINDER_EMAIL_PW } });
}

function buildReminderEmail(customerName, invoices, appUrl) {
  const total = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const rows  = invoices.map((inv) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1e293b;">${inv.invoiceNo}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">₹${Number(inv.amount).toLocaleString("en-IN")}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;"><span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">Pending</span></td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;"><a href="${appUrl}/payments" style="background:#2563eb;color:#fff;padding:5px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;">Pay Now</a></td>
    </tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 32px;">
      <div style="color:#fff;font-size:18px;font-weight:800;">$ Smart Billing — Payment Reminder</div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 8px;">Dear ${customerName},</p>
      <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;">You have <strong>${invoices.length} pending invoice${invoices.length > 1 ? "s" : ""}</strong> totalling <strong style="color:#dc2626;">₹${total.toLocaleString("en-IN")}</strong>. Please clear your dues at the earliest.</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Invoice</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Amount</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Status</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Action</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${appUrl}/payments" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">Clear All Dues →</a>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">If you have already paid, please ignore this message.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="font-size:11px;color:#cbd5e1;margin:0;">Sent by Smart Billing · Automated Payment Reminder</p>
    </div>
  </div>
</body></html>`;
}

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Invalid email or password. For demo, use admin@smartbilling.com / admin123" });
    const token = jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ message: "Login successful", token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed. Database may not be connected." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  if (password.length < 6)  return res.status(400).json({ error: "Password must be at least 6 characters." });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: "Please provide a valid email address." });
  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "This email address is already registered." });
    const newUser = await User.create({ email: email.toLowerCase(), password: bcrypt.hashSync(password, 10), role: "user" });
    res.status(201).json({ message: "Account registered successfully! You can now log in.", user: { id: newUser._id, email: newUser.email, role: newUser.role } });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed. Database may not be connected." });
  }
});

app.get("/api/customers", authenticateToken, async (req, res) => {
  try {
    const customers = await Customer.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(customers.map(docToObj));
  } catch { res.status(500).json({ error: "Failed to fetch customers." }); }
});

app.post("/api/customers", authenticateToken, async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email) return res.status(400).json({ error: "Name, phone, and email are required." });
  try {
    const exists = await Customer.findOne({ userId: req.user.id, $or: [{ phone }, { email: email.toLowerCase() }] });
    if (exists) return res.status(409).json({ error: "Customer with this phone or email already exists." });
    const customer = await Customer.create({ userId: req.user.id, name, phone, email: email.toLowerCase() });
    res.status(201).json(docToObj(customer));
  } catch { res.status(500).json({ error: "Failed to create customer." }); }
});

app.put("/api/customers/:id", authenticateToken, async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email) return res.status(400).json({ error: "Name, phone, and email are required." });
  try {
    const customer = await Customer.findOne({ _id: req.params.id, userId: req.user.id });
    if (!customer) return res.status(404).json({ error: "Customer not found." });
    const duplicate = await Customer.findOne({ userId: req.user.id, _id: { $ne: req.params.id }, $or: [{ phone }, { email: email.toLowerCase() }] });
    if (duplicate) return res.status(409).json({ error: "Another customer with this phone or email already exists." });
    const oldName = customer.name;
    customer.name  = name;
    customer.phone = phone;
    customer.email = email.toLowerCase();
    await customer.save();
    if (oldName !== name) {
      await Invoice.updateMany({ userId: req.user.id, customer: oldName }, { customer: name });
    }
    res.json(docToObj(customer));
  } catch { res.status(500).json({ error: "Failed to update customer." }); }
});

app.delete("/api/customers/:id", authenticateToken, async (req, res) => {
  try {
    const result = await Customer.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!result) return res.status(404).json({ error: "Customer not found." });
    res.json({ message: "Customer deleted successfully." });
  } catch { res.status(500).json({ error: "Failed to delete customer." }); }
});

app.get("/api/invoices", authenticateToken, async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(invoices.map(docToObj));
  } catch { res.status(500).json({ error: "Failed to fetch invoices." }); }
});

app.post("/api/invoices", authenticateToken, async (req, res) => {
  const { customer, amount, status } = req.body;
  if (!customer || !amount) return res.status(400).json({ error: "Customer and amount are required." });
  try {
    const count = await Invoice.countDocuments({ userId: req.user.id });
    const invoiceNo = `INV${String(count + 1).padStart(3, "0")}`;
    const invoice = await Invoice.create({ userId: req.user.id, invoiceNo, customer, amount: Number(amount), status: status || "Pending" });
    if (status === "Paid") {
      const pCount = await Payment.countDocuments({ userId: req.user.id });
      await Payment.create({ userId: req.user.id, paymentId: `PAY${String(pCount + 1).padStart(3, "0")}`, invoiceNo, amount: Number(amount), method: "Cash", status: "Paid" });
    }
    res.status(201).json(docToObj(invoice));
  } catch { res.status(500).json({ error: "Failed to create invoice." }); }
});

app.put("/api/invoices/:id", authenticateToken, async (req, res) => {
  const { customer, amount, status } = req.body;
  if (!customer || !amount) return res.status(400).json({ error: "Customer and amount are required." });
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.id });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    const newStatus = status || invoice.status;
    invoice.customer = customer;
    invoice.amount   = Number(amount);
    invoice.status   = newStatus;
    await invoice.save();
    const relatedPayments = await Payment.find({ userId: req.user.id, invoiceNo: invoice.invoiceNo });
    if (newStatus === "Paid") {
      if (relatedPayments.length === 0) {
        const pCount = await Payment.countDocuments({ userId: req.user.id });
        await Payment.create({ userId: req.user.id, paymentId: `PAY${String(pCount + 1).padStart(3, "0")}`, invoiceNo: invoice.invoiceNo, amount: Number(amount), method: "Cash", status: "Paid" });
      } else {
        await Payment.updateMany({ userId: req.user.id, invoiceNo: invoice.invoiceNo }, { amount: Number(amount), status: "Paid" });
      }
    } else if (newStatus === "Pending") {
      await Payment.updateMany({ userId: req.user.id, invoiceNo: invoice.invoiceNo }, { status: "Pending" });
    }
    res.json(docToObj(invoice));
  } catch { res.status(500).json({ error: "Failed to update invoice." }); }
});

app.delete("/api/invoices/:id", authenticateToken, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    await Payment.deleteMany({ userId: req.user.id, invoiceNo: invoice.invoiceNo });
    res.json({ message: "Invoice and related payments deleted successfully." });
  } catch { res.status(500).json({ error: "Failed to delete invoice." }); }
});

app.get("/api/payments", authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(payments.map(docToObj));
  } catch { res.status(500).json({ error: "Failed to fetch payments." }); }
});

app.post("/api/payments", authenticateToken, async (req, res) => {
  const { invoiceNo, amount, method, status } = req.body;
  if (!invoiceNo || !amount) return res.status(400).json({ error: "Invoice number and amount are required." });
  try {
    await Invoice.findOneAndUpdate({ userId: req.user.id, invoiceNo }, { status: "Paid" });
    const pCount = await Payment.countDocuments({ userId: req.user.id });
    const payment = await Payment.create({ userId: req.user.id, paymentId: `PAY${String(pCount + 1).padStart(3, "0")}`, invoiceNo, amount: Number(amount), method: method || "Cash", status: status || "Paid" });
    res.status(201).json(docToObj(payment));
  } catch { res.status(500).json({ error: "Failed to record payment." }); }
});

app.put("/api/payments/:id", authenticateToken, async (req, res) => {
  const { amount, method, status } = req.body;
  if (!amount) return res.status(400).json({ error: "Amount is required." });
  try {
    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user.id });
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    const newStatus = status || payment.status;
    payment.amount = Number(amount);
    payment.method = method || payment.method;
    payment.status = newStatus;
    await payment.save();
    const invUpdate = newStatus === "Paid" ? { status: "Paid", amount: Number(amount) } : { status: "Pending" };
    await Invoice.findOneAndUpdate({ userId: req.user.id, invoiceNo: payment.invoiceNo }, invUpdate);
    res.json(docToObj(payment));
  } catch { res.status(500).json({ error: "Failed to update payment." }); }
});

app.delete("/api/payments/:id", authenticateToken, async (req, res) => {
  try {
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    await Invoice.findOneAndUpdate({ userId: req.user.id, invoiceNo: payment.invoiceNo }, { status: "Pending" });
    res.json({ message: "Payment deleted and related invoice reverted to Pending." });
  } catch { res.status(500).json({ error: "Failed to delete payment." }); }
});

app.post("/api/reminders/email", authenticateToken, async (req, res) => {
  const transporter = createMailTransporter();
  if (!transporter) return res.status(503).json({ error: "Email service not configured. Add REMINDER_EMAIL and REMINDER_EMAIL_PASSWORD to your Render environment variables." });
  try {
    const { customerName } = req.body;
    let query = { userId: req.user.id, status: "Pending" };
    if (customerName) query.customer = { $regex: customerName, $options: "i" };
    const targetInvoices = await Invoice.find(query);
    if (targetInvoices.length === 0) return res.json({ sent: [], failed: [], skipped: [], message: "No pending invoices found." });

    const byCustomer = {};
    targetInvoices.forEach((inv) => {
      const key = inv.customer || "Unknown";
      if (!byCustomer[key]) byCustomer[key] = [];
      byCustomer[key].push(inv);
    });

    const sent = [], failed = [], skipped = [];
    const appUrl = process.env.APP_URL || "https://smart-billing.onrender.com";

    for (const [name, invoices] of Object.entries(byCustomer)) {
      const customer = await Customer.findOne({ userId: req.user.id, name: { $regex: `^${name}$`, $options: "i" } });
      if (!customer?.email) { skipped.push({ customer: name, reason: "No email address on record" }); continue; }
      const total = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
      try {
        await transporter.sendMail({
          from: `"Smart Billing" <${REMINDER_EMAIL}>`,
          to: customer.email,
          subject: `Payment Reminder — ₹${total.toLocaleString("en-IN")} due`,
          html: buildReminderEmail(name, invoices, appUrl),
          text: `Dear ${name}, you have ${invoices.length} pending invoice(s) totalling Rs.${total.toLocaleString("en-IN")}. Visit ${appUrl}/payments to pay.`,
        });
        sent.push({ customer: name, email: customer.email, amount: total, invoices: invoices.map((i) => i.invoiceNo) });
      } catch (err) {
        failed.push({ customer: name, email: customer.email, error: err.message });
      }
    }
    res.json({ sent, failed, skipped, summary: `${sent.length} sent, ${failed.length} failed, ${skipped.length} skipped` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/reminders/email/single", authenticateToken, async (req, res) => {
  const transporter = createMailTransporter();
  if (!transporter) return res.status(503).json({ error: "Email service not configured. Add REMINDER_EMAIL and REMINDER_EMAIL_PASSWORD to your Render environment variables." });
  const { email, customerName, invoiceNo, amount } = req.body;
  if (!email || !customerName || !invoiceNo || !amount) return res.status(400).json({ error: "email, customerName, invoiceNo and amount are required." });
  const appUrl = process.env.APP_URL || "https://smart-billing.onrender.com";
  try {
    const invoice = await Invoice.findOne({ userId: req.user.id, invoiceNo });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    await transporter.sendMail({
      from: `"Smart Billing" <${REMINDER_EMAIL}>`,
      to: email,
      subject: `Payment Reminder — Invoice ${invoiceNo} (₹${Number(amount).toLocaleString("en-IN")} due)`,
      html: buildReminderEmail(customerName, [{ invoiceNo, amount }], appUrl),
      text: `Dear ${customerName}, invoice ${invoiceNo} of Rs.${Number(amount).toLocaleString("en-IN")} is pending. Visit ${appUrl}/payments to pay.`,
    });
    res.json({ success: true, email });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const [customers, invoices] = await Promise.all([
      Customer.find({ userId: uid }),
      Invoice.find({ userId: uid }),
    ]);
    const paid    = invoices.filter((i) => i.status === "Paid");
    const pending = invoices.filter((i) => i.status === "Pending");
    res.json({
      totalCustomers: customers.length,
      totalInvoices:  invoices.length,
      totalRevenue:   paid.reduce((s, i) => s + i.amount, 0),
      pendingAmount:  pending.reduce((s, i) => s + i.amount, 0),
      recentCustomers: customers.slice(-5).reverse().map(docToObj),
      recentInvoices:  invoices.slice(-5).reverse().map(docToObj),
    });
  } catch { res.status(500).json({ error: "Failed to load stats." }); }
});

// ===================================================
// AI Action endpoint — lets the AI Assistant perform actions
// ===================================================
app.post("/api/ai/action", authenticateToken, async (req, res) => {
  const { action, params } = req.body;
  const uid = req.user.id;

  try {
    switch (action) {

      case "send-reminders": {
        const transporter = createMailTransporter();
        if (!transporter) {
          return res.json({ success: false, message: "Email not configured. Set REMINDER_EMAIL and REMINDER_EMAIL_PASSWORD in Render env vars." });
        }
        const pendingInvoices = await Invoice.find({ userId: uid, status: "Pending" });
        if (pendingInvoices.length === 0) {
          return res.json({ success: true, message: "No pending invoices found. All invoices are paid!" });
        }
        const byCustomer = {};
        pendingInvoices.forEach((inv) => {
          const key = inv.customer || "Unknown";
          if (!byCustomer[key]) byCustomer[key] = [];
          byCustomer[key].push(inv);
        });
        const sent = [], failed = [], skipped = [];
        const appUrl = process.env.APP_URL || "https://smart-billing-system-0m7z.onrender.com";
        for (const [name, invoices] of Object.entries(byCustomer)) {
          const customer = await Customer.findOne({ userId: uid, name: { $regex: `^${name}$`, $options: "i" } });
          if (!customer?.email) { skipped.push({ customer: name, reason: "No email" }); continue; }
          const total = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
          try {
            await transporter.sendMail({
              from: `"Smart Billing" <${REMINDER_EMAIL}>`,
              to: customer.email,
              subject: `Payment Reminder — ₹${total.toLocaleString("en-IN")} due`,
              html: buildReminderEmail(name, invoices, appUrl),
            });
            sent.push({ customer: name, email: customer.email, amount: total, invoices: invoices.map((i) => i.invoiceNo) });
          } catch (err) {
            failed.push({ customer: name, email: customer.email, error: err.message });
          }
        }
        const summary = `${sent.length} sent, ${failed.length} failed, ${skipped.length} skipped`;
        return res.json({ success: true, action: "send-reminders", sent, failed, skipped, summary });
      }

      case "pending-summary": {
        const pendingInvoices = await Invoice.find({ userId: uid, status: "Pending" }).sort({ createdAt: -1 });
        const totalAmount = pendingInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
        const byCustomer = {};
        pendingInvoices.forEach((inv) => {
          const key = inv.customer || "Unknown";
          byCustomer[key] = (byCustomer[key] || 0) + 1;
        });
        return res.json({
          success: true,
          action: "pending-summary",
          totalInvoices: pendingInvoices.length,
          totalAmount,
          customerBreakdown: Object.entries(byCustomer).map(([name, count]) => ({ name, count })),
          invoices: pendingInvoices.map((i) => ({ invoiceNo: i.invoiceNo, customer: i.customer, amount: i.amount, createdAt: i.createdAt })),
        });
      }

      case "customer-count": {
        const count = await Customer.countDocuments({ userId: uid });
        const invoices = await Invoice.countDocuments({ userId: uid });
        const payments = await Payment.countDocuments({ userId: uid });
        const pendingTotal = await Invoice.aggregate([
          { $match: { userId: uid, status: "Pending" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        return res.json({
          success: true,
          action: "customer-count",
          customers: count,
          invoices,
          payments,
          pendingAmount: pendingTotal[0]?.total || 0,
        });
      }

      default:
        return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("AI action error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const stateMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  res.json({
    status: "OK",
    message: "Smart Billing API is running!",
    timestamp: new Date().toISOString(),
    db: stateMap[mongoState] || "unknown",
    dbConnected,
    usingEmbeddedDB,
    mongoUri: usingEmbeddedDB ? "embedded (auto)" : (MONGODB_URI ? (MONGODB_URI.includes("mongodb+srv") ? "mongodb+srv://..." : MONGODB_URI.replace(/\/\/.*@/, "//***@")) : "not set"),
  });
});

app.get("/api/setup", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const stateMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const dbStatus = stateMap[mongoState] || "unknown";
  res.json({
    server: { status: "running", port: PORT },
    database: {
      status: dbStatus,
      mode: usingEmbeddedDB ? "embedded (auto)" : MONGODB_URI.includes("mongodb+srv") ? "MongoDB Atlas" : "external",
      connected: mongoState === 1,
    },
    loginStatus: mongoState === 1 ? "ready" : "starting up...",
    demoCredentials: {
      email: "admin@smartbilling.com",
      password: "admin123",
    },
    envVars: {
      MONGODB_URI: { set: !!process.env.MONGODB_URI, using: usingEmbeddedDB ? "embedded fallback" : "external" },
      JWT_SECRET: { set: !!process.env.JWT_SECRET || JWT_SECRET !== "dev_jwt_secret_change_in_prod" },
    },
    message: dbStatus === "connected"
      ? "Everything is ready! Login with admin@smartbilling.com / admin123"
      : "Database is starting. Refresh in a few seconds.",
  });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use("/api/*", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
  app.get("*", (req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
}

function docToObj(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id  = obj._id?.toString();
  return obj;
}

app.listen(PORT, () => {
  connectWithRetry();
  console.log(`\nSmart Billing Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Setup info:  http://localhost:${PORT}/api/setup`);
  console.log(`Database: ${process.env.MONGODB_URI ? "MongoDB Atlas (configured)" : "Embedded MongoDB (auto)"}`);
  console.log(`Note: The embedded database starts in a few seconds.\n`);
});
