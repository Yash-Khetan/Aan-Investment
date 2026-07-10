import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { exportReport, getReport } from "./api";
import { REPORT_LABELS, REPORT_NAMES, type ReportFilters, type ReportName, type ReportRow } from "./types";
import { REPORT_COLUMNS } from "./columns";

const LOAN_STATUSES = ["PENDING", "ACTIVE", "OVERDUE", "NPA", "CLOSED", "WRITTEN_OFF"];
const COLLATERAL_TYPES = ["PROPERTY", "MORTGAGE", "STRUCTURED_CREDIT", "PERSONAL_GUARANTEE", "CORPORATE_GUARANTEE", "NONE"];
const COLLECTION_STATUSES = ["OPEN", "PROMISE_TO_PAY", "FOLLOW_UP", "CLOSED"];

function renderCell(row: ReportRow, key: string, type: string) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">—</span>;
  if (type === "currency") return formatCurrency(value as number | string);
  if (type === "date") return formatDate(value as string);
  if (type === "badge") return <Badge status={String(value)} />;
  return String(value);
}

export function ReportsPage() {
  const [report, setReport] = useState<ReportName>("loan-register");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["report", report, filters],
    queryFn: () => getReport(report, filters),
  });

  const columns = REPORT_COLUMNS[report];
  const tableColumns: Column<ReportRow>[] = columns.map((col) => ({
    key: col.key,
    header: col.header,
    render: (row) => renderCell(row, col.key, col.type),
  }));

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(format);
    setExportError(null);
    try {
      await exportReport(report, filters, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Read-only MIS reports. View as JSON, or export to CSV / Excel." />

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <SelectField
            label="Report"
            value={report}
            onChange={(e) => setReport(e.target.value as ReportName)}
          >
            {REPORT_NAMES.map((name) => (
              <option key={name} value={name}>
                {REPORT_LABELS[name]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Loan Status"
            value={filters.loanStatus ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, loanStatus: e.target.value || undefined }))}
          >
            <option value="">Any</option>
            {LOAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>

          {report === "collateral-report" && (
            <SelectField
              label="Collateral Type"
              value={filters.collateralType ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, collateralType: e.target.value || undefined }))}
            >
              <option value="">Any</option>
              {COLLATERAL_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          )}

          {report === "collections-report" && (
            <SelectField
              label="Collection Status"
              value={filters.collectionStatus ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, collectionStatus: e.target.value || undefined }))}
            >
              <option value="">Any</option>
              {COLLECTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          )}

          <TextField
            label="Start Date"
            type="date"
            value={filters.startDate ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
          />
          <TextField
            label="End Date"
            type="date"
            value={filters.endDate ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" onClick={() => handleExport("csv")} disabled={exporting !== null}>
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="secondary" onClick={() => handleExport("xlsx")} disabled={exporting !== null}>
            {exporting === "xlsx" ? "Exporting..." : "Export Excel"}
          </Button>
          {data && <span className="ml-auto text-xs text-slate-400">{data.count} rows</span>}
        </div>
        {exportError && <div className="mt-2 text-xs text-red-600">{exportError}</div>}
      </Card>

      {isLoading && <LoadingState label="Running report..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load report."} />}
      {data && data.data.length === 0 && <EmptyState message="No rows match these filters." />}
      {data && data.data.length > 0 && (
        <Table columns={tableColumns} rows={data.data} rowKey={(row) => JSON.stringify(row)} />
      )}
    </div>
  );
}
