import { useState, type ReactNode } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

/**
 * Card shell for the Ledger's read-only Borrower/Loan panels. These only ever
 * display what the Borrower and Loan modules already hold — nothing on them is
 * editable, and the Ledger never writes back through them.
 *
 * `children` is always shown (the minimal, at-a-glance fields). `moreDetails`,
 * when given, is collapsed behind a "View more details" toggle so the page
 * stays scannable by default.
 */
export function SummaryCard({
  title,
  badges,
  children,
  moreDetails,
}: {
  title: string;
  badges?: ReactNode;
  children: ReactNode;
  moreDetails?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
      {moreDetails && (
        <>
          {expanded && <div className="mt-5 flex flex-col gap-5">{moreDetails}</div>}
          <Button
            type="button"
            variant="ghost"
            className="mt-3 self-start px-0 text-xs"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "View less details" : "View more details"}
          </Button>
        </>
      )}
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
