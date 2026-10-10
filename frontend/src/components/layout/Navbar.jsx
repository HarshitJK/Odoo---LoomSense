import { useAuth } from "../../context/AuthContext.jsx";
export default function Navbar() {
  const {user,logout}=useAuth();
  return <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3"><span className="font-semibold text-slate-700">Textile Production &amp; Profit Intelligence</span><span className="text-sm text-slate-500">{user?.role?.replaceAll("_"," ")} <button className="ml-3 text-blue-700" onClick={logout}>Sign out</button></span></header>;
}
