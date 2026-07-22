import { Link } from "react-router-dom";

// const MODULES = [
//   { name: "Dashboard", desc: "Live portfolio health, risk, and collections at a glance." },
//   { name: "Reports", desc: "Loan register, customer, collateral, collections & document MIS." },
//   { name: "Accounting Export", desc: "ERP-ready double-entry rows across seven transaction types." },
//   { name: "Collateral", desc: "Security valuations, LTV, and insurance tracking." },
//   { name: "Collections", desc: "Recovery activity trail and Promise to Pay workflow." },
//   { name: "Documents", desc: "Secure, centralized document vault per loan or borrower." },
// ];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Aan Finance &amp; Investment Pvt. Ltd.</div>
          <div className="text-lg font-semibold text-slate-900">Aan Investment LMS</div>
        </div>
        {/* <Link
          to="/dashboard"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Go to Dashboard →
        </Link> */}
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="flex flex-col items-start gap-6 py-20">
          {/* <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Internal platform · Hyderabad, Telangana
          </span> */}
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-900 lg:text-5xl">
            The Loan Management System for Aan Finance &amp; Investment
          </h1>
          {/* <p className="max-w-2xl text-lg text-slate-600">
            Aan Finance &amp; Investment Private Limited is a non-banking financial company (NBFC)
            engaged in secured and structured lending, incorporated in 2019 and headquartered in
            Hyderabad. This system manages the complete loan lifecycle internally — borrowers,
            collateral, collections, accounting exports, and MIS reporting — in one place.
          </p> */}
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Go to Dashboard →
            </Link>
            {/* <span className="text-xs text-slate-400">CIN U65929TG2019PTC133298</span> */}
          </div>
        </section>

        {/* <section className="border-t border-slate-100 py-16">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">What's inside</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.name} className="rounded-lg border border-slate-200 p-5">
                <div className="text-sm font-semibold text-slate-900">{m.name}</div>
                <div className="mt-1.5 text-sm text-slate-500">{m.desc}</div>
              </div>
            ))}
          </div>
        </section> */}

        {/* <footer className="flex items-center justify-between border-t border-slate-100 py-8 text-xs text-slate-400">
          <span>Aan Finance &amp; Investment Private Limited · Registered office: King Koti Road, Abids, Hyderabad, Telangana 500001</span>
          <span>Internal use only</span>
        </footer> */}
      </main>
    </div>
  );
}
