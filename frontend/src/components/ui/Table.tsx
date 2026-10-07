import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Amounts and counts are right-aligned so their digits line up. */
  align?: "left" | "right";
  /** Content for this column in the totals row, when the table has one. */
  total?: ReactNode;
  className?: string;
}

/**
 * The app's one table. Rows are clickable when `onRowClick` is given — the
 * whole row opens the record, there is no separate View button. A totals row
 * is drawn when any column defines `total`.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  totalLabel = "Total",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  totalLabel?: string;
}) {
  const hasTotals = columns.some((c) => c.total !== undefined);
  const alignClass = (c: Column<T>) => (c.align === "right" ? "text-right" : "text-left");

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600 ${alignClass(col)}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter") onRowClick(row);
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={onRowClick ? "cursor-pointer hover:bg-accent-soft focus:bg-accent-soft focus:outline-none" : ""}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-slate-800 ${alignClass(col)} ${col.className ?? ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasTotals && (
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
            <tr>
              {columns.map((col, i) => (
                <td key={col.key} className={`whitespace-nowrap px-4 py-3 ${alignClass(col)}`}>
                  {i === 0 ? totalLabel : (col.total ?? "")}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
