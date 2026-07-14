import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/borrowers", label: "Borrowers" },
  { to: "/loans", label: "Loans" },
  { to: "/interest", label: "Interest Engine" },
  { to: "/repayment", label: "Repayment Engine" },
  { to: "/payments", label: "Payments" },
  { to: "/reports", label: "Reports" },
  { to: "/accounting", label: "Accounting Export" },
  { to: "/accounting-entries", label: "Accounting Ledger" },
  { to: "/collateral", label: "Collateral" },
  { to: "/collections", label: "Collections" },
  { to: "/documents", label: "Documents" },
];

const ADMIN_NAV_ITEM = { to: "/admin/users", label: "Admin" };

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = user?.roles.includes("ADMIN") ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <Link to="/" className="block px-5 py-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">Aan Investment</div>
          <div className="text-lg font-semibold text-slate-900">LMS</div>
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
