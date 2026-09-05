import type { ReactNode } from "react";
import { Card } from "../../../components/ui/Card";

/**
 * Card shell for the Ledger's read-only Borrower/Loan panels. These only ever
 * display what the Borrower and Loan modules already hold — nothing on them is
 * editable, and the Ledger never writes back through them.
 */
export function SummaryCard({
  title,
  badges,
  children,
}: {
  title: string;
  badges?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  );
}

/** Denser sibling of the slide-over's DetailSection — this page is full width. */
export function SummaryGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}
