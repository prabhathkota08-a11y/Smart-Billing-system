import { useState, useRef, useEffect } from "react";
import "./AIAssistant.css";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { useVoiceRecognition } from "../hooks/useVoiceRecognition";
import { getToken } from "../services/api";

const SYSTEM_PROMPT = `You are a helpful AI assistant for a Smart Billing application.
You can help users with:
- Billing and invoicing questions
- Payment tracking and reminders
- Customer management
- Financial reports and analytics
- General business advice

The app has these action capabilities (tell user to click the buttons below):
1. Send email reminders to all customers with pending invoices
2. Show summary of all pending invoices
3. Show account statistics (customer/invoice/payment counts)

When user asks to send reminders or check pending invoices, tell them to use the action buttons below.
Keep responses concise and actionable.`;

function AIAssistant({ embedded = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const messagesEndRef = useRef(null);
  const { speak, cancel, isSpeaking, isSupported: ttsSupported } = useTextToSpeech();

  const handleVoiceResult = (text) => {
    if (text) setInput(text);
  };

  const { isListening, startListening, stopListening, isSupported: sttSupported } = useVoiceRecognition({
    onResult: handleVoiceResult,
    continuous: false,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function callAiAction(action, params = {}) {
    const token = getToken();
    if (!token) {
      addMessage("assistant", "You need to log in first to perform actions.");
      return;
    }
    setActionLoading(action);
    try {
      const res = await fetch("/api/ai/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, params }),
      });
      const data = await res.json();
      if (data.success) {
        addMessage("assistant", formatActionResult(data));
      } else {
        addMessage("assistant", `Action failed: ${data.message || data.error || "Unknown error"}`);
      }
    } catch (err) {
      addMessage("assistant", `Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  function formatActionResult(data) {
    switch (data.action) {
      case "send-reminders": {
        let msg = "";
        if (data.meta?.type === "preview") {
          msg += "📧 **Preview Mode** — Showing what the email looks like:\n\n";
        }
        if (data.meta?.type === "gmail") {
          msg += "✅ **Emails delivered via SMTP!**\n\n";
        }
        msg += `**Reminder Report**\n\n`;
        if (data.sent?.length) {
          msg += `✅ ${data.meta?.type === "gmail" ? "Sent to" : "Prepared for"} ${data.sent.length} customer(s):\n`;
          data.sent.forEach((s) => {
            msg += `  • ${s.customer} (${s.email}) — ₹${Number(s.amount).toLocaleString("en-IN")}\n`;
            if (s.invoices) msg += `      Invoices: ${s.invoices.join(", ")}\n`;
          });
        }
        if (data.failed?.length) {
          msg += `\n❌ Failed: ${data.failed.length}\n`;
          data.failed.forEach((f) => msg += `  • ${f.customer} — ${f.error}\n`);
        }
        if (data.skipped?.length) {
          msg += `\n⏭️ Skipped: ${data.skipped.length}\n`;
          data.skipped.forEach((s) => msg += `  • ${s.customer} — ${s.reason}\n`);
        }
        if (!data.sent?.length && !data.failed?.length && !data.skipped?.length) {
          msg += "No pending invoices found. All invoices are paid!";
        }
        if (data.meta?.type === "preview") {
          msg += `\n\n📧 To send real emails, add REMINDER_EMAIL (your Gmail) and REMINDER_EMAIL_PASSWORD (Gmail App Password) to Render environment variables.`;
        }
        return msg;
      }
      case "pending-summary": {
        if (data.totalInvoices === 0) {
          return "No pending invoices. All invoices are paid!";
        }
        let msg = `**Pending Invoices Summary**\n\n`;
        msg += `Total: ${data.totalInvoices} invoices\n`;
        msg += `Amount: ₹${Number(data.totalAmount).toLocaleString("en-IN")}\n\n`;
        msg += `**By Customer:**\n`;
        data.customerBreakdown?.forEach((c) => {
          msg += `  • ${c.name}: ${c.count} invoice(s)\n`;
        });
        msg += `\n**Details:**\n`;
        data.invoices?.forEach((inv) => {
          msg += `  • ${inv.invoiceNo} — ${inv.customer} — ₹${Number(inv.amount).toLocaleString("en-IN")}\n`;
        });
        return msg;
      }
      case "customer-count": {
        return `**Account Stats**\n\n👥 Customers: ${data.customers}\n📄 Invoices: ${data.invoices}\n💰 Payments: ${data.payments}\n⏳ Pending Amount: ₹${Number(data.pendingAmount).toLocaleString("en-IN")}`;
      }
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  function addMessage(role, content) {
    setMessages((prev) => [...prev, { role, content }]);
  }

  const handleSend = async (text) => {
    const messageText = text || input;
    if (!messageText.trim() || loading) return;

    addMessage("user", messageText);
    setInput("");
    setLoading(true);

    try {
      const contextMessages = [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: messageText }] },
      ];

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ messages: contextMessages }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);
      const assistantText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I'm sorry, I couldn't process that request.";

      addMessage("assistant", assistantText);
    } catch (err) {
      addMessage("assistant", `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const speakMessage = (text) => {
    if (isSpeaking) cancel();
    else speak(text);
  };

  const actionButtons = [
    {
      label: "📧 Send Reminders",
      sub: "Email all pending invoices",
      action: "send-reminders",
    },
    {
      label: "📋 Pending Summary",
      sub: "View all unpaid invoices",
      action: "pending-summary",
    },
    {
      label: "📊 Account Stats",
      sub: "Customers, invoices, payments",
      action: "customer-count",
    },
  ];

  const suggestions = [
    "How do I create an invoice?",
    "How to add a new customer?",
    "What payment methods are supported?",
    "Explain the dashboard stats",
  ];

  return (
    <div className="ai-container">
      <div className="ai-header">
        <span style={{ fontSize: "24px" }}>🤖</span>
        <h2>AI Assistant</h2>
      </div>

      <div className="ai-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <h3>Hello! How can I help you?</h3>
            <p>Ask me anything, or use the action buttons below:</p>
            <div className="ai-suggestions">
              {actionButtons.map((btn, i) => (
                <button
                  key={i}
                  className="ai-action-btn"
                  onClick={() => callAiAction(btn.action)}
                  disabled={actionLoading === btn.action}
                >
                  {actionLoading === btn.action ? "⏳..." : btn.label}
                  <span className="ai-action-sub">{btn.sub}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: "20px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
              <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>Or ask a question:</p>
              <div className="ai-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="ai-suggestion-chip" onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {actionButtons.some(() => true) && (
              <div className="ai-action-bar">
                {actionButtons.map((btn, i) => (
                  <button
                    key={i}
                    className="ai-action-btn-sm"
                    onClick={() => callAiAction(btn.action)}
                    disabled={actionLoading === btn.action}
                  >
                    {actionLoading === btn.action ? "⏳" : btn.label}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                {msg.role === "assistant" && ttsSupported && (
                  <button
                    onClick={() => speakMessage(msg.content)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      marginTop: "8px",
                      fontSize: "16px",
                      opacity: 0.6,
                    }}
                    title={isSpeaking ? "Stop" : "Listen"}
                  >
                    {isSpeaking ? "🔊" : "🔈"}
                  </button>
                )}
              </div>
            ))}
          </>
        )}
        {loading && (
          <div className="ai-message assistant" style={{ opacity: 0.6 }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type your message..."
          disabled={loading}
        />
        {sttSupported && (
          <button
            className={`voice-btn ${isListening ? "listening" : ""}`}
            onClick={isListening ? stopListening : startListening}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            🎤
          </button>
        )}
        <button onClick={() => handleSend()} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default AIAssistant;
