import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

const LANGUAGES = [
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "en", label: "English" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    shop_name: "",
    owner_name: "",
    phone: "",
    password: "",
    preferred_language: "hi",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(form);
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Couldn't create your account. Please try again.");
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
          Set up your shop once. Every bahi page you photograph after that
          gets read, sorted and added to your books.
        </p>
        <ul className="auth-panel-points">
          <li>No email needed — just your phone number</li>
          <li>Works in Hindi, Marathi and mixed-script writing</li>
          <li>Your data stays tied to your shop only</li>
        </ul>
      </aside>

      <main className="auth-form-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Set up your shop</h2>
          <p className="auth-subtitle">Takes less than a minute.</p>

          {error && <div className="auth-error">{error}</div>}

          <label className="field">
            <span>Shop name</span>
            <input
              type="text"
              placeholder="Shree Ganesh Kirana Store"
              value={form.shop_name}
              onChange={(e) => updateField("shop_name", e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              placeholder="Ramesh Patil"
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="98765 43210"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              required
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="field">
            <span>Preferred language</span>
            <select
              value={form.preferred_language}
              onChange={(e) => updateField("preferred_language", e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>

          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>

          <p className="auth-switch">
            Already have a shop set up? <Link to="/login">Log in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}