import { useState, useRef, useEffect } from "react";
import "./AIAssistant.css";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { useVoiceRecognition } from "../hooks/useVoiceRecognition";

const API_KEY = "AIzaSyB4Gv-JJ5JKbVKE2r39X6zQqP-j4fMEXcM";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = `You are a helpful AI assistant for a Smart Billing application. 
You can help users with:
- Billing and invoicing questions
- Payment tracking and reminders
- Customer management
- Financial reports and analytics
- General business advice

Keep your responses concise and actionable. If the user asks about specific data they need to check in the app, guide them to the appropriate section.`;

function AIAssistant({ embedded = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { speak, cancel, isSpeaking, isSupported: ttsSupported } = useTextToSpeech();

  const handleVoiceResult = (text) => {
    if (text) {
      setInput(text);
    }
  };

  const { isListening, startListening, stopListening, isSupported: sttSupported } = useVoiceRecognition({
    onResult: handleVoiceResult,
    continuous: false,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text) => {
    const messageText = text || input;
    if (!messageText.trim() || loading) return;

    const userMessage = { role: "user", content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const contextMessages = [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        ...newMessages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contextMessages }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that request.";

      const assistantMessage = { role: "assistant", content: assistantText };
      setMessages([...newMessages, assistantMessage]);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const speakMessage = (text) => {
    if (isSpeaking) {
      cancel();
    } else {
      speak(text);
    }
  };

  const suggestions = [
    "How do I create an invoice?",
    "Show me the dashboard summary",
    "How to add a new customer?",
    "What payment methods are supported?",
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
            <p>Ask me anything about billing, invoices, payments, or customers.</p>
            <div className="ai-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="ai-suggestion-chip" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`ai-message ${msg.role}`}>
              {msg.content}
              {msg.role === "assistant" && ttsSupported && (
                <button
                  onClick={() => speakMessage(msg.content)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    marginTop: "8px", fontSize: "16px", opacity: 0.6,
                  }}
                  title={isSpeaking ? "Stop" : "Listen"}
                >
                  {isSpeaking ? "🔊" : "🔈"}
                </button>
              )}
            </div>
          ))
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
