import { useState } from "react";
import { CHART_INK, STATUS_COLORS, type StatusRole } from "./palette";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  detail?: string;
  role: StatusRole;
}

/**
 * Horizontal bar chart per the dataviz skill's mark spec: bars capped at 24px thick,
 * 4px rounded data-end / square at the baseline, a 2px surface gap between bars, a
 * hairline baseline, and a direct label (category + value) on every bar — required
 * here because these are status colors, which must never carry meaning through color
 * alone (palette.md "Status palette").
 */
export function HorizontalBarChart({ data }: { data: BarDatum[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-0.5">
      {data.map((d) => {
        const widthPct = Math.max((d.value / max) * 100, 2);
        const isHovered = hovered === d.key;
        return (
          <div
            key={d.key}
            className="group flex items-center gap-3 py-[3px]"
            onMouseEnter={() => setHovered(d.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(d.key)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            role="img"
            aria-label={`${d.label}: ${d.displayValue}${d.detail ? `, ${d.detail}` : ""}`}
          >
            <div className="w-28 shrink-0 text-xs font-medium" style={{ color: CHART_INK.secondary }}>
              {d.label}
            </div>
            <div
              className="relative h-5 flex-1 rounded-r"
              style={{ borderLeft: `1px solid ${CHART_INK.baseline}` }}
            >
              <div
                className="h-5 rounded-r-[4px] transition-[filter] duration-100"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: STATUS_COLORS[d.role],
                  filter: isHovered ? "brightness(1.08)" : undefined,
                }}
              />
              {isHovered && (
                <div
                  className="absolute -top-8 left-0 z-10 whitespace-nowrap rounded-md px-2 py-1 text-xs text-white shadow-lg"
                  style={{ backgroundColor: CHART_INK.primary }}
                >
                  <span className="font-semibold">{d.displayValue}</span>
                  {d.detail && <span className="ml-1 opacity-80">· {d.detail}</span>}
                </div>
              )}
            </div>
            <div
              className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums"
              style={{ color: CHART_INK.primary }}
            >
              {d.displayValue}
            </div>
          </div>
        );
      })}
    </div>
  );
}
