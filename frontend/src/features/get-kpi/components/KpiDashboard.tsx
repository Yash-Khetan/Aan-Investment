import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, StatCard } from "../../../components/ui/Card";
import { TextField, SelectField } from "../../../components/ui/Field";
import { EmptyState } from "../../../components/ui/States";
import { formatCurrency } from "../../../lib/format";
import { CHART_INK, STATUS_COLORS } from "../../../components/charts/palette";
import type { LedgerRow } from "../types";

const INFLOW_COLOR = STATUS_COLORS.good;
const OUTFLOW_COLOR = STATUS_COLORS.critical;
const DONUT_COLORS = [STATUS_COLORS.warning, STATUS_COLORS.good, "#6366f1", STATUS_COLORS.critical];

function monthKey(date: string | null): string | null {
  if (!date) return null;
  return date.slice(0, 7);
}

export function KpiDashboard({ rows }: { rows: LedgerRow[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vchTypeFilter, setVchTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const vchTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.vchType).filter((v): v is string => !!v))),
    [rows],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (dateFrom && row.date && row.date < dateFrom) return false;
      if (dateTo && row.date && row.date > dateTo) return false;
      if (vchTypeFilter !== "ALL" && row.vchType !== vchTypeFilter) return false;
      if (search.trim() && !row.particulars.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, vchTypeFilter, search]);

  const stats = useMemo(() => {
    const totalDebit = filteredRows.reduce((sum, r) => sum + (r.debit ?? 0), 0);
    const totalCredit = filteredRows.reduce((sum, r) => sum + (r.credit ?? 0), 0);
    const rowsWithBalance = filteredRows.filter((r) => r.balance != null);
    const outstanding = rowsWithBalance.length > 0 ? rowsWithBalance[rowsWithBalance.length - 1].balance! : 0;
    const totalOutput = filteredRows.reduce((sum, r) => sum + (r.output && !r.output.error ? r.output.result ?? 0 : 0), 0);
    return { totalDebit, totalCredit, outstanding, totalOutput };
  }, [filteredRows]);

  const balanceSeries = useMemo(
    () =>
      filteredRows
        .filter((r) => r.balance != null && r.date)
        .map((r) => ({ date: r.date!, balance: r.balance! })),
    [filteredRows],
  );

  const monthlySeries = useMemo(() => {
    const map = new Map<string, { month: string; debit: number; credit: number }>();
    for (const row of filteredRows) {
      const key = monthKey(row.date);
      if (!key) continue;
      const entry = map.get(key) ?? { month: key, debit: 0, credit: 0 };
      entry.debit += row.debit ?? 0;
      entry.credit += row.credit ?? 0;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredRows]);

  const vchTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredRows) {
      const key = row.vchType ?? "Unspecified";
      map.set(key, (map.get(key) ?? 0) + (row.debit ?? 0) + (row.credit ?? 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <TextField label="From Date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <TextField label="To Date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <SelectField label="Vch Type" value={vchTypeFilter} onChange={(e) => setVchTypeFilter(e.target.value)}>
            <option value="ALL">All Types</option>
            {vchTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Search Particulars"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. NEFT, Interest…"
          />
        </div>
      </Card>

      {filteredRows.length === 0 ? (
        <EmptyState message="No rows match the current filters." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Debit (Outflow)"
              value={formatCurrency(stats.totalDebit, 2)}
              sub={`${filteredRows.filter((r) => r.debit != null).length} entries`}
            />
            <StatCard
              label="Total Credit (Inflow)"
              value={formatCurrency(stats.totalCredit, 2)}
              sub={`${filteredRows.filter((r) => r.credit != null).length} entries`}
            />
            <StatCard
              label="Outstanding Balance"
              value={`${formatCurrency(Math.abs(stats.outstanding), 2)} ${stats.outstanding >= 0 ? "Dr" : "Cr"}`}
            />
            <StatCard label="Total Computed Output" value={formatCurrency(stats.totalOutput, 2)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Balance Over Time</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={balanceSeries}>
                  <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_INK.secondary }} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_INK.secondary }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number, 2)} />
                  <Line type="monotone" dataKey="balance" stroke={CHART_INK.primary} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Debit vs Credit by Month</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlySeries}>
                  <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_INK.secondary }} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_INK.secondary }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number, 2)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="debit" name="Debit (Out)" fill={OUTFLOW_COLOR} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="credit" name="Credit (In)" fill={INFLOW_COLOR} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Volume by Voucher Type</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={vchTypeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {vchTypeBreakdown.map((entry, idx) => (
                      <Cell key={entry.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v as number, 2)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
