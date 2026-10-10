import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
export default function LoginPage() {
  const { user, login } = useAuth(), navigate = useNavigate();
  const [email,setEmail]=useState(""), [password,setPassword]=useState(""), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  async function submit(e) { e.preventDefault();setBusy(true);setError("");try {const u=await login(email,password);navigate(homeFor(u.role));}catch(e){setError(e.response?.data?.detail || "Unable to sign in");}finally{setBusy(false);} }
  return <main className="min-h-screen bg-slate-100 grid place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-xl bg-white shadow-sm p-8 space-y-5"><h1 className="text-2xl font-bold">LoomSense</h1><p>Sign in to factory operations</p><label className="block">Email<input required type="email" autoComplete="username" className="mt-1 w-full border rounded-lg p-3" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Password<input required type="password" autoComplete="current-password" className="mt-1 w-full border rounded-lg p-3" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-blue-600 text-white p-3 disabled:opacity-50">{busy?"Signing in…":"Sign in"}</button></form></main>;
}
