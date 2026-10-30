import { useState } from "react";
import { Panel as Section, Facts } from "../../../components/ui/Facts";
import { formatAccrualMonth, formatCurrency, formatDate, formatPercent } from "../../../lib/format";
import { FIGURE } from "../../../lib/glossary";
import { labelOf } from "../../ledger/components/codedLabel";
import type { InterestAccrual } from "../../ledger/types";
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

/**
 * How the loan's interest accrued till today is arrived at: where accrual
 * starts, the rate and day-count it runs at, what has been settled against
 * it, and what of it is due and overdue.
 *
 * Every figure comes from the backend's one accrual calculation
 * (modules/ledger/accrual.ts) — nothing here recomputes money. A value the
 * loan's data does not support is left as a dash rather than guessed at.
 */
function InterestBreakdown({ accrual }: { accrual: InterestAccrual | null }) {
  if (!accrual) {
    return (
      <Section title="Interest breakdown">
        <p className="text-sm text-slate-500">
          No interest accrual is available for this loan yet.
        </p>
      </Section>
    );
  }

  const basisLabel = INTEREST_BASIS_OPTIONS.find((o) => o.value === accrual.interestBasis)?.label ?? accrual.interestBasis;
  const dayCount =
    accrual.interestBasis === null
      ? null
      : `${basisLabel}${accrual.includeOpeningClosingDays ? ", counting first and last day" : ""}`;

  const accruedValue = (
    <span className="text-base font-semibold text-slate-900">
      {formatCurrency(accrual.interestAccruedTillToday, 2)}
    </span>
  );
  const overdueValue =
    accrual.interestOverdue > 0 ? (
      <span className="text-dr">{formatCurrency(accrual.interestOverdue, 2)}</span>
    ) : (
      formatCurrency(0, 2)
    );

  return (
    <Section
      title="Interest breakdown"
      aside={<span className="text-xs text-slate-500">As of {formatDate(accrual.asOf)}</span>}
    >
      <Facts
        rows={[
          ["Accrual starts", formatDate(accrual.accrualStartDate)],
          ["Calculated as of", formatDate(accrual.asOf)],
          [FIGURE.rate, accrual.interestRatePercent === null ? null : `${accrual.interestRatePercent.toFixed(2)}% a year`],
          ["Day count", dayCount],
          [FIGURE.interestAccrued, accruedValue],
          ["Posted at month-end", formatCurrency(accrual.postedInterest, 2)],
          [
            accrual.unpostedFrom
              ? `Accruing since ${formatAccrualMonth(accrual.unpostedFrom)}, not yet posted`
              : "Not yet posted",
            formatCurrency(accrual.unpostedInterest, 2),
          ],
          ["Interest received", formatCurrency(accrual.interestPaid, 2)],
          ["TDS deducted at source", formatCurrency(accrual.tdsAdjusted, 2)],
          [FIGURE.interestDue, formatCurrency(accrual.interestDue, 2)],
          [FIGURE.overdue, overdueValue],
          ["Last posted accrual", formatDate(accrual.lastPostedAccrualDate)],
        ]}
      />
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Accrued is what the loan has earned to date, interest for the month in progress included. Interest due is what
        has been posted at month-end, net of TDS, and is still unpaid; overdue is the part of that past its due date.
        They are three different figures.
      </p>
    </Section>
  );
}

/**
 * What the loan's total payable is made of — principal, then each month whose
 * interest is still unpaid, oldest first — the interest accrued behind it,
 * and the terms it runs on.
 */
export function LoanOverviewTab({ loan }: { loan: Loan }) {
  const [showCibil, setShowCibil] = useState(false);
  const s = loan.snapshot;
  const config = loan.interestConfig ?? null;
  const basis = INTEREST_BASIS_OPTIONS.find((o) => o.value === config?.interestBasis)?.label ?? config?.interestBasis;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-2">
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

        <InterestBreakdown accrual={loan.interestAccrual ?? null} />
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
