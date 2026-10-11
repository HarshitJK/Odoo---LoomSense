import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import "./LoginPage.css";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      navigate(homeFor(u.role));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not sign in. Check your email and password, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="LoomSense">
        <div className="login-wordmark">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M7 5v22h20M15 5v14h12M23 5v6h4" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          <span>LoomSense</span>
        </div>

        <div className="login-brand-content">
          <p className="login-eyebrow">TEXTILE OPERATIONS</p>
          <h1>A clearer view of<br />your factory.</h1>
          <p className="login-brand-description">
            Orders, production and quality.<br />Connected in one workspace.
          </p>
          <div className="login-weave" aria-hidden="true">
            <svg viewBox="0 0 480 180" fill="none">
              {Array.from({ length: 23 }, (_, i) => (
                <path key={`warp-${i}`} d={`M${20 + i * 20} 0v180`} stroke="currentColor" strokeOpacity={i % 5 === 0 ? ".5" : ".18"} />
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <path key={`weft-${i}`} d={`M0 ${10 + i * 20}h480`} stroke="currentColor" strokeOpacity={i % 3 === 0 ? ".5" : ".18"} />
              ))}
              <path d="M100 0v130h240V50H180v130M260 0v90H60v90M420 0v170H380V10H300" stroke="currentColor" strokeWidth="3" />
            </svg>
          </div>
        </div>

        <p className="login-brand-footer">From the first thread to the finished roll.</p>
      </section>

      <section className="login-entry" aria-labelledby="login-heading">
        <div className="login-form-wrap">
          <header className="login-form-header">
            <p className="login-eyebrow">YOUR WORKSPACE</p>
            <h2 id="login-heading">Welcome back.</h2>
            <p>Sign in to continue to LoomSense.</p>
          </header>

          <form onSubmit={submit} className="login-form" aria-busy={busy}>
            <div className="login-field">
              <label htmlFor="login-email">Email address</label>
              <input id="login-email" name="email" required type="email" autoComplete="username" placeholder="you@company.com" disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-password">
                <input id="login-password" name="password" required type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="login-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" className="login-submit" disabled={busy}>
              <span aria-live="polite">{busy ? "Signing in…" : "Sign in"}</span>
              {!busy && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <p className="login-help">Need access or help signing in?<br /><span>Contact your factory administrator.</span></p>
        </div>
        <footer className="login-entry-footer">LoomSense <span aria-hidden="true">/</span> Factory operations</footer>
      </section>
    </main>
  );
}
