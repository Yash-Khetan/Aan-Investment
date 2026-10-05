import { formatAccrualMonth, formatCurrency } from "../../../lib/format";
import type { BalanceBifurcation } from "../types";

/**
 * A balance split into principal and each month's unpaid net interest, one
 * mini-row per part — the way a cell subdivides in the source Excel sheet.
 * Meant to sit in a table cell with no padding of its own, so the mini-rows'
 * dividers run edge to edge. The parts always add up to the balance beside it.
 */
export function BalanceBifurcationCell({ bifurcation }: { bifurcation: BalanceBifurcation | null }) {
  const lines: Array<{ key: string; label: string; amount: number }> = [];

  if (bifurcation) {
    if (bifurcation.principal > 0) {
      lines.push({ key: "principal", label: "Principal", amount: bifurcation.principal });
    } else if (bifurcation.principal < 0) {
      lines.push({ key: "principal", label: "Excess received", amount: -bifurcation.principal });
    }
    for (const m of bifurcation.interest) {
      lines.push({ key: m.month, label: formatAccrualMonth(m.month), amount: m.amount });
    }
  }

  if (lines.length === 0) return <div className="px-4 py-2.5 text-slate-400">—</div>;

  return (
    <div className="divide-y divide-slate-300">
      {lines.map((line) => (
        <div key={line.key} className="flex justify-between gap-6 whitespace-nowrap px-4 py-1.5">
          <span className="text-slate-500">{line.label}</span>
          <span className="tabular-nums text-slate-900">{formatCurrency(line.amount, 2)}</span>
        </div>
      ))}
    </div>
  );
}
