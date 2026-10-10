import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar, { AccountBox, NavLinks } from "./Sidebar.jsx";

/** Desktop: sidebar plus page. Under 768px: a top bar whose menu button opens the same navigation full width. */
export default function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
          <span className="text-lg font-semibold text-gray-900">LoomSense</span>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-900"
          >
            {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>
        </header>

        {menuOpen && (
          <div id="mobile-menu" className="border-b border-gray-200 bg-white md:hidden">
            <div className="p-3">
              <NavLinks large onNavigate={() => setMenuOpen(false)} />
            </div>
            <AccountBox />
          </div>
        )}

        <main className="mx-auto w-full max-w-[80rem] flex-1 space-y-6 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
