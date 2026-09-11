import { Fragment } from "react";
import { Card } from "../../../components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import type { DpdClassification, DpdGrid, DpdMonth } from "../types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Months with no figure read as "X" — before the loan's first entry, or not yet reached. Not the same as 0. */
const NO_DATA = "X";

/** RBI labels, as the classification reads on the Loans page. */
const CLASSIFICATION_LABELS: Record<DpdClassification, string> = {
  STD: "Standard",
  "SMA-0": "SMA-0",
  "SMA-1": "SMA-1",
  "SMA-2": "SMA-2",
  NPA: "NPA",
};

/** Tinted by classification so a delinquent stretch is visible without reading every number. */
const CLASSIFICATION_CLASS: Record<DpdClassification, string> = {
  STD: "text-slate-700",
  "SMA-0": "text-amber-700 font-medium",
  "SMA-1": "text-orange-700 font-semibold",
  "SMA-2": "text-orange-700 font-semibold",
  NPA: "text-red-700 font-semibold",
};

const headerCell =
  "border border-slate-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-700";

const labelCell = "border border-slate-200 px-3 py-2 text-center text-sm text-slate-700";

function cellClass(month: DpdMonth | null): string {
  return month ? CLASSIFICATION_CLASS[month.classification] : "text-slate-700";
}

/**
 * The loan's Days Past Due history, one row per year and one column per month
 * — the credit-bureau style grid.
 *
 * Read-only and per loan: a borrower's loans each carry their own delinquency
 * history, and the Ledger page is already scoped to a single loan. The grid
 * spans exactly the loan's life, from its first ledger entry to its maturity.
 */
export function DpdHistoryTable({
  grid,
  isLoading,
  error,
}: {
  grid: DpdGrid | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) return <LoadingState label="Loading DPD history..." />;
  if (error) {
    return <ErrorState message={error instanceof Error ? error.message : "Failed to load DPD history."} />;
  }
  if (!grid || grid.years.length === 0) {
    return (
      <Card className="p-4">
        <SectionHeading />
        <EmptyState message="No DPD history yet for this loan." />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <SectionHeading />

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={headerCell}>Year</th>
              <th className={headerCell}>Area</th>
              {MONTHS.map((m) => (
                <th key={m} className={headerCell}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.years.map((row, yearIndex) => {
              const shade = yearIndex % 2 === 1 ? "bg-slate-50" : "bg-white";
              return (
                <Fragment key={row.year}>
                  <tr className={shade}>
                    <td rowSpan={2} className={`${labelCell} font-medium text-slate-900`}>
                      {row.year}
                    </td>
                    <td className={labelCell}>dpd</td>
                    {row.months.map((month, i) => (
                      <td
                        key={i}
                        className={`${labelCell} ${cellClass(month)}`}
                        title={month?.isCurrentMonth ? "Month in progress — not yet final" : undefined}
                      >
                        {month ? month.dpd : NO_DATA}
                        {month?.isCurrentMonth && <span className="text-slate-400">*</span>}
                      </td>
                    ))}
                  </tr>
                  <tr className={shade}>
                    <td className={`${labelCell} whitespace-nowrap`}>asset classification</td>
                    {row.months.map((month, i) => (
                      <td key={i} className={`${labelCell} ${cellClass(month)} whitespace-nowrap`}>
                        {month ? CLASSIFICATION_LABELS[month.classification] : NO_DATA}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Days past due at each month end, measured against this ledger&apos;s month-end interest. Receipts clear the
        oldest month first; a part-payment lowers the amount overdue but does not reset the day count. An asterisk marks
        the month still in progress. <span className="font-medium">{NO_DATA}</span> means no figure — before the
        loan&apos;s first entry, or a month not yet reached.
      </p>
    </Card>
  );
}

function SectionHeading() {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">DPD History</h2>;
}
