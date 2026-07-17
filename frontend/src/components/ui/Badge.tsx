const PALETTE: Record<string, string> = {
  // loan / generic status
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-orange-100 text-orange-800",
  NPA: "bg-red-100 text-red-800",
  CLOSED: "bg-slate-100 text-slate-700",
  WRITTEN_OFF: "bg-red-200 text-red-900",
  // payment / installment status
  SUCCESS: "bg-emerald-100 text-emerald-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-700",
  // collection status
  OPEN: "bg-blue-100 text-blue-800",
  PROMISE_TO_PAY: "bg-purple-100 text-purple-800",
  FOLLOW_UP: "bg-amber-100 text-amber-800",
  // insurance / generic
  EXPIRED: "bg-red-100 text-red-800",
  NOT_INSURED: "bg-slate-100 text-slate-700",
  INACTIVE: "bg-slate-100 text-slate-700",
};

export function Badge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const classes = PALETTE[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
