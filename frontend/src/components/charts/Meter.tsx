import { CHART_INK, SEQUENTIAL_BLUE, STATUS_COLORS, type StatusRole } from "./palette";

function severityForPct(pct: number): StatusRole {
  if (pct < 10) return "good";
  if (pct < 25) return "warning";
  return "critical";
}

export function Meter({
  label,
  pct,
  sub,
}: {
  label: string;
  pct: number;
  sub?: string;
}) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const role = severityForPct(clamped);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium" style={{ color: CHART_INK.secondary }}>
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: STATUS_COLORS[role] }}>
          {clamped.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: SEQUENTIAL_BLUE.track }}
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${clamped}%`, backgroundColor: STATUS_COLORS[role] }}
        />
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: CHART_INK.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}
