import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser, setToken } from "../services/api";
import "./Login.css";

function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = isRegister
        ? await registerUser(email, password)
        : await loginUser(email, password);

      if (data.token) {
        setToken(data.token);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userEmail", data.user?.email || email);
        navigate("/dashboard");
      } else {
        setError(data.message || "Operation successful, but no token received.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: "center", fontSize: "40px", marginBottom: "8px" }}>$</div>
        <h1 className="login-title">Smart Billing</h1>
        <p className="login-subtitle">
          {isRegister ? "Create your account" : "Sign in to your account"}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="login-toggle">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => { setIsRegister(!isRegister); setError(""); }}>
            {isRegister ? "Sign In" : "Register"}
          </button>
        </div>

        {!isRegister && (
          <div className="demo-creds">
            <strong>Demo:</strong> admin@smartbilling.com / admin123
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
