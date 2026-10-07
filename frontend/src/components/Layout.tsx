import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { GlobalSearch } from "./GlobalSearch";

/**
 * Five destinations. A loan's ledger, DPD history, collateral, guarantors and
 * imported history are tabs on the loan's own page, not places of their own.
 */
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/loans", label: "Loans" },
  { to: "/borrowers", label: "Borrowers" },
  { to: "/documents", label: "Documents" },
  { to: "/reports", label: "Reports" },
];

const ADMIN_NAV_ITEM = { to: "/admin/users", label: "Users" };

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
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 -translate-x-full flex-col bg-slate-900 text-slate-300 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isNavOpen ? "translate-x-0" : ""
        }`}
      >
        <Link to="/dashboard" className="block px-5 pb-6 pt-5">
          <div className="text-base font-semibold text-white">Aan Finance</div>
          <div className="text-xs text-slate-400">Loan book</div>
        </Link>
        <nav className="flex flex-col gap-0.5 overflow-y-auto px-3" aria-label="Main">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsNavOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-[15px] font-medium transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-5 py-4">
          {user && (
            <div className="mb-1 truncate text-sm text-white" title={user.email}>
              {user.firstName} {user.lastName ?? ""}
            </div>
          )}
          <button onClick={handleLogout} className="text-xs text-slate-400 transition-colors hover:text-white">
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <GlobalSearch />
          <div className="ml-auto hidden gap-2 sm:flex">
            <Link
              to="/loans/new"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              New loan
            </Link>
            <Link
              to="/borrowers/new"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              New borrower
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Page title row. `back` puts a link to the parent list above the title;
 * `actions` sit at the right of the title (stacking under it on phones).
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  /** Badges or short facts shown beside the title. */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link to={back.to} className="mb-2 inline-block text-sm text-slate-500 hover:text-accent">
          ‹ {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {meta}
          </div>
          {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
