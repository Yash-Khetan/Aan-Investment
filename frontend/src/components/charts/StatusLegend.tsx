import { CHART_INK, STATUS_COLORS, type StatusRole } from "./palette";

const LABELS: Record<StatusRole, string> = {
  good: "Healthy",
  warning: "Needs attention",
  serious: "Serious",
  critical: "At risk",
};

export function StatusLegend({ roles }: { roles: StatusRole[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {roles.map((role) => (
        <div key={role} className="flex items-center gap-1.5 text-xs" style={{ color: CHART_INK.secondary }}>
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[role] }} />
          {LABELS[role]}
        </div>
      ))}
    </div>
  );
}
