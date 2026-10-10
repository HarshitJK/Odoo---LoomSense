import { NavLink } from "react-router-dom";
import { LayoutDashboard, Truck, Boxes, Factory, Users, ShieldCheck } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/track", label: "Buyer Tracking", icon: Truck },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/production", label: "Production", icon: Factory },
  { to: "/workers", label: "Workers", icon: Users },
  { to: "/quality", label: "Quality", icon: ShieldCheck },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 bg-slate-900 text-slate-200 md:block">
      <div className="px-6 py-5 text-xl font-bold tracking-wide text-white">LoomSense</div>
      <nav className="flex flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-slate-700 text-white" : "hover:bg-slate-800"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
