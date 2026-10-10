import { NavLink } from "react-router-dom";
import { LayoutDashboard, ClipboardList, Boxes, Factory, Users, ShieldCheck, ScanLine } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { roleLabel } from "../../utils/labels.js";
import Button from "../common/Button.jsx";

// Plain names, three short sections. Paths match App.jsx.
const SECTIONS = [
  { title: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Operations",
    items: [
      { to: "/orders", label: "Orders", icon: ClipboardList },
      { to: "/inventory", label: "Stock", icon: Boxes },
      { to: "/production", label: "Machines", icon: Factory },
      { to: "/quality", label: "Quality checks", icon: ShieldCheck },
      { to: "/scan", label: "Scan QR code", icon: ScanLine },
    ],
  },
  { title: "People", items: [{ to: "/workers", label: "Workers", icon: Users }] },
];

const MANAGER_PATHS = ["/orders", "/inventory", "/production", "/quality", "/scan"];
const QC_PATHS = ["/quality", "/scan"];

/** Sections and links this role can open. */
function sectionsFor(role) {
  const allowed = role === "OWNER" ? null : role === "PRODUCTION_MANAGER" ? MANAGER_PATHS : QC_PATHS;
  return SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !allowed || allowed.includes(i.to)) })).filter(
    (s) => s.items.length
  );
}

/** The navigation list, used by the desktop sidebar and the phone menu. `large` makes tap targets bigger. */
export function NavLinks({ onNavigate, large = false }) {
  const { user } = useAuth();
  return (
    <nav aria-label="Main" className="space-y-5">
      {sectionsFor(user?.role).map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1 text-xs font-medium text-blue-200">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 text-sm ${large ? "min-h-12" : "min-h-9"} ${
                      isActive ? "bg-blue-700 font-medium text-white" : "text-blue-100 hover:bg-blue-800"
                    }`
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Signed-in person with a Sign out button. */
export function AccountBox() {
  const { user, logout } = useAuth();
  return (
    <div className="space-y-2 border-t border-blue-800 p-4 text-sm">
      <p className="truncate text-white">{user?.email}</p>
      <p className="text-xs text-blue-200">{roleLabel(user?.role)}</p>
      <Button onClick={logout} className="w-full">Sign out</Button>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-blue-950 bg-blue-900 md:flex">
      <div className="px-6 py-5 text-lg font-semibold text-white">LoomSense</div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks />
      </div>
      <AccountBox />
    </aside>
  );
}
