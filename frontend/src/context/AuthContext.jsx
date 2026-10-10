import { createContext, useContext, useEffect, useState } from "react";
import client from "../api/client.js";
const Context = createContext(null);
export const useAuth = () => useContext(Context);
export const homeFor = role => role === "OWNER" ? "/" : role === "PRODUCTION_MANAGER" ? "/orders" : "/quality";
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true);
  const logout = () => { sessionStorage.removeItem("loomsenseToken"); setUser(null); };
  useEffect(() => {
    if (!sessionStorage.getItem("loomsenseToken")) { setLoading(false); return; }
    client.get("/api/auth/me").then(r => setUser(r.data)).catch(logout).finally(() => setLoading(false));
  }, []);
  useEffect(() => { window.addEventListener("session-expired", logout); return () => window.removeEventListener("session-expired", logout); }, []);
  async function login(email, password) {
    const r = await client.post("/api/auth/login", { email, password });
    sessionStorage.setItem("loomsenseToken", r.data.accessToken);
    try { const me = await client.get("/api/auth/me"); setUser(me.data); return me.data; }
    catch (e) { logout(); throw e; }
  }
  return <Context.Provider value={{user, loading, login, logout}}>{children}</Context.Provider>;
}
