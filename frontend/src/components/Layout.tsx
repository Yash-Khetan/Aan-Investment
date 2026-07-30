import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/borrowers", label: "Borrowers" },
  { to: "/loans", label: "Loans" },
  { to: "/collateral", label: "Collateral" },
  { to: "/documents", label: "Documents" },
  { to: "/disbursements", label: "Disbursements" },
  { to: "/repayment", label: "Repayment Engine" },
  { to: "/payments", label: "Payments" },
  { to: "/collections", label: "Collections" },
  { to: "/reports", label: "Reports" },
  { to: "/accounting", label: "Accounting Export" },
  { to: "/accounting-entries", label: "Accounting Ledger" },
  
];

const ADMIN_NAV_ITEM = { to: "/admin/users", label: "Admin" };

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = user?.roles.includes("ADMIN") ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
  const [isNavOpen, setIsNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {isNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setIsNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:relative lg:w-60 lg:translate-x-0 ${
          isNavOpen ? "translate-x-0" : ""
        }`}
      >
        <Link to="/" className="block px-5 py-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">Aan Investment</div>
          <div className="text-lg font-semibold text-slate-900">LMS</div>
        </Link>
        <nav className="flex flex-col gap-0.5 overflow-y-auto px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsNavOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 px-5 py-4">
          {user && (
            <div className="mb-2 truncate text-xs font-medium text-slate-600" title={user.email}>
              {user.firstName} {user.lastName ?? ""}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm font-semibold text-slate-900">Aan Investment LMS</div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
