import { Fragment } from "react";
import { Card } from "../../../components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import type { DpdGrid, DpdMonth } from "../types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Months outside the loan's life read as "X" — no obligation existed, which is not the same as one met on time (0). */
const NO_DATA = "X";

const headerCell =
  "border border-slate-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-700";

const labelCell = "border border-slate-200 px-3 py-2 text-center text-sm text-slate-700";

/** Late months are tinted by severity so a delinquent stretch is visible without reading every number. */
function dpdCellClass(month: DpdMonth | null): string {
  if (!month || month.dpd <= 0) return "text-slate-700";
  if (month.dpd <= 30) return "text-amber-700 font-medium";
  if (month.dpd <= 90) return "text-orange-700 font-semibold";
  return "text-red-700 font-semibold";
}

function cellValue(month: DpdMonth | null, field: "dpd" | "bucket") {
  return month ? month[field] : NO_DATA;
}

/**
 * The loan's Days Past Due history, one row per year and one column per month
 * — the credit-bureau style grid.
 *
 * Read-only and per loan: a borrower's loans each carry their own delinquency
 * history, and the Ledger page is already scoped to a single loan.
 *
 * Every elapsed month here is a frozen record of what that month's DPD was.
 * Only the month still in progress moves, and it is marked as such.
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
                    <td rowSpan={3} className={`${labelCell} font-medium text-slate-900`}>
                      {row.year}
                    </td>
                    <td className={labelCell}>dpd</td>
                    {row.months.map((month, i) => (
                      <td
                        key={i}
                        className={`${labelCell} ${dpdCellClass(month)}`}
                        title={month?.isCurrentMonth ? "Month in progress — not yet final" : undefined}
                      >
                        {cellValue(month, "dpd")}
                        {month?.isCurrentMonth && <span className="text-slate-400">*</span>}
                      </td>
                    ))}
                  </tr>
                  <tr className={shade}>
                    <td className={labelCell}>bucket</td>
                    {row.months.map((month, i) => (
                      <td key={i} className={labelCell}>
                        {cellValue(month, "bucket")}
                      </td>
                    ))}
                  </tr>
                  <tr className={shade}>
                    <td className={labelCell}>other</td>
                    {row.months.map((_, i) => (
                      <td key={i} className={labelCell}>
                        {NO_DATA}
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
        Days past due at each month end, measured against this loan&apos;s scheduled obligations. A part-payment does
        not clear an obligation, so it does not reset DPD. Elapsed months are frozen as recorded; an asterisk marks the
        month still in progress. <span className="font-medium">{NO_DATA}</span> means the loan was not live that month.
      </p>
    </Card>
  );
}

function SectionHeading() {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">DPD History</h2>;
}
