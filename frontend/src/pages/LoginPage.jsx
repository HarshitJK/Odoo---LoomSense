import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
import Button from "../components/common/Button.jsx";
import Card from "../components/common/Card.jsx";
import FormField, { Input } from "../components/common/FormField.jsx";
import Notice from "../components/common/Notice.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import PublicPage from "../components/common/PublicPage.jsx";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <PublicPage>
      <PageHeader title="Sign in" subtitle="Sign in to factory operations." />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Email" required>
            <Input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Password" required>
            <Input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? "Signing in" : "Sign in"}
          </Button>
        </form>
      </Card>
    </PublicPage>
  );
}
