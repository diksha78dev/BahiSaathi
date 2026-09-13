import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(phone.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Couldn't log in. Check your phone number and password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <aside className="auth-panel">
        <div className="ledger-mark">बही</div>
        <h1>BahiSaathi</h1>
        <p className="auth-panel-tagline">
          Your handwritten ledger, understood by a computer. Snap a photo of
          today's bahi page and let the udhaar sort itself out.
        </p>
        <ul className="auth-panel-points">
          <li>Photograph any page, in Hindi, Marathi or English</li>
          <li>Every customer's dues, tracked automatically</li>
          <li>A month-end summary without touching a calculator</li>
        </ul>
      </aside>

      <main className="auth-form-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Log in to your shop</h2>
          <p className="auth-subtitle">Enter the phone number you registered with.</p>

          {error && <div className="auth-error">{error}</div>}

          <label className="field">
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>

          <p className="auth-switch">
            New shop? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}