import { useState, type ReactNode } from "react";
import { formatAccrualMonth, formatCurrency, formatDate, formatPercent } from "../../../lib/format";
import { FIGURE } from "../../../lib/glossary";
import { labelOf } from "../../ledger/components/codedLabel";
import { INTEREST_BASIS_OPTIONS } from "../interestConfig";
import {
  ASSET_CLASSIFICATIONS,
  CIBIL_ACCOUNT_STATUSES,
  CIBIL_COLLATERAL_TYPES,
  CREDIT_TYPES,
  PAYMENT_FREQUENCIES,
  formatTenure,
} from "../types";
import type { Loan } from "../types";

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Label on the left, value on the right — one fact per line, easy to scan down. */
function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-6 py-2 text-sm">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-medium text-slate-900">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * What the loan's total payable is made of — principal, then each month whose
 * interest is still unpaid, oldest first — and the terms it runs on.
 */
export function LoanOverviewTab({ loan }: { loan: Loan }) {
  const [showCibil, setShowCibil] = useState(false);
  const s = loan.snapshot;
  const config = loan.interestConfig ?? null;
  const basis = INTEREST_BASIS_OPTIONS.find((o) => o.value === config?.interestBasis)?.label ?? config?.interestBasis;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Section title="What is owed" aside={<span className="text-xs text-slate-500">As of {formatDate(s.asOf)}</span>}>
          {!s.hasEntries ? (
            <p className="text-sm text-slate-500">
              Nothing has been disbursed yet. Record the first disbursement on the Ledger tab.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 text-slate-700">{s.principalOutstanding < 0 ? "Excess received" : "Principal"}</td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    {formatCurrency(Math.abs(s.principalOutstanding), 2)}
                  </td>
                </tr>
                {s.bifurcation.interest.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 text-slate-700">Interest for {formatAccrualMonth(m.month)}</td>
                    <td className="py-2 text-right font-medium text-slate-900">{formatCurrency(m.amount, 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="pt-2.5 font-semibold text-slate-900">{FIGURE.totalPayable}</td>
                  <td className="pt-2.5 text-right text-base font-semibold text-slate-900">
                    {formatCurrency(s.totalPayable, 2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </Section>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-3">
        <Section title="Terms">
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <Facts
              rows={[
                [FIGURE.sanctioned, formatCurrency(loan.sanctionedAmount)],
                [FIGURE.rate, `${Number(loan.interestRate).toFixed(2)}% a year`],
                ["TDS", `${Number(loan.tdsRatePercent).toFixed(2)}% of interest`],
                ["Day count", basis],
                ["Count first and last day", config ? (config.includeOpeningClosingDays ? "Yes" : "No") : null],
                ["Rates apply from", formatDate(config?.effectiveFrom)],
              ]}
            />
            <Facts
              rows={[
                ["Sanctioned on", formatDate(loan.sanctionDate)],
                ["Matures on", formatDate(loan.maturityDate)],
                ["Tenure", formatTenure(loan.sanctionDate, loan.maturityDate)],
                ["Repayment", loan.repaymentType.replace(/_/g, " ").toLowerCase()],
                ["Loan type", loan.loanType === "SECURED" ? "Secured" : "Unsecured"],
                ["Return to date (IRR)", formatPercent(loan.irr)],
              ]}
            />
          </div>
          {loan.purpose && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700">{loan.purpose}</p>}
        </Section>

        <Section
          title="CIBIL reporting"
          aside={
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => setShowCibil((v) => !v)}>
              {showCibil ? "Hide" : "Show"}
            </button>
          }
        >
          {showCibil ? (
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <Facts
                rows={[
                  ["Credit / account type", labelOf(CREDIT_TYPES, loan.creditType)],
                  ["Account status", labelOf(CIBIL_ACCOUNT_STATUSES, loan.cibilAccountStatus)],
                  ["Account classification", labelOf(ASSET_CLASSIFICATIONS, loan.assetClassification)],
                ]}
              />
              <Facts
                rows={[
                  ["Payment frequency", labelOf(PAYMENT_FREQUENCIES, loan.paymentFrequency)],
                  ["EMI amount", loan.emiAmount ? formatCurrency(loan.emiAmount) : null],
                  ["Collateral type", labelOf(CIBIL_COLLATERAL_TYPES, loan.collateralType)],
                  ["Collateral value", loan.collateralValue ? formatCurrency(loan.collateralValue) : null],
                ]}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">The fields reported to the credit bureau.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
