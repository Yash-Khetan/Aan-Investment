import type { ReactNode } from "react";

export interface MoneyFigure {
  /** Plain-words label, always the same wording for the same figure (see lib/glossary.ts). */
  label: string;
  value: ReactNode;
  /** Small line under the figure — a count, a date, a qualifier. */
  note?: ReactNode;
  /** Colours the figure: "alert" for money overdue, "muted" for zero/not applicable. */
  tone?: "default" | "alert" | "muted";
}

const TONE: Record<NonNullable<MoneyFigure["tone"]>, string> = {
  default: "text-slate-900",
  alert: "text-dr",
  muted: "text-slate-400",
};

/**
 * One ruled line of figures, like a line in an account book: each figure's
 * label above it, figures separated by vertical rules. The single place a
 * loan's (or the portfolio's) headline numbers are read from.
 */
export function MoneyStrip({ figures }: { figures: MoneyFigure[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <dl className="grid grid-cols-2 divide-slate-200 sm:grid-cols-3 lg:flex lg:divide-x">
        {figures.map((f) => (
          <div
            key={f.label}
            className="min-w-0 border-b border-r border-slate-200 px-5 py-4 lg:flex-1 lg:border-b-0 lg:border-r-0"
          >
            <dt className="text-sm text-slate-500">{f.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${TONE[f.tone ?? "default"]}`}>
              {f.value}
            </dd>
            {f.note && <dd className="mt-0.5 text-xs text-slate-500">{f.note}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
