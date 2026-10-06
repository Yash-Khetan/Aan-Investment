import type { ReactNode } from "react";

/** A titled, ruled block of a detail page. `aside` sits at the right of the title (a link, a date, a toggle). */
export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {aside}
      </div>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

export type Fact = [label: string, value: ReactNode];

/**
 * One fact per line — label on the left, value on the right — so a column of
 * facts reads straight down. Facts with no value show a dash rather than
 * disappearing, so every record has the same shape.
 */
export function Facts({ rows }: { rows: Fact[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-6 py-2 text-sm">
          <dt className="shrink-0 text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-slate-900">
            {value === null || value === undefined || value === "" ? <span className="text-slate-400">—</span> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
