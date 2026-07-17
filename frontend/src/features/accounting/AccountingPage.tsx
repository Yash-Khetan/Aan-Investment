import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { exportAccountingEntries, getAccountingEntries } from "./api";
import {
  ACCOUNTING_CATEGORIES,
  ACCOUNTING_CATEGORY_LABELS,
  type AccountingCategory,
  type AccountingEntryRow,
  type AccountingFilters,
} from "./types";

const COLUMNS: Column<AccountingEntryRow>[] = [
  { key: "transactionDate", header: "Date", render: (r) => formatDate(r.transactionDate) },
  { key: "loanNumber", header: "Loan Number", render: (r) => r.loanNumber },
  { key: "customerName", header: "Customer", render: (r) => r.customerName },
  { key: "referenceNumber", header: "Reference", render: (r) => r.referenceNumber },
  { key: "debitAccount", header: "Debit Account", render: (r) => r.debitAccount },
  { key: "creditAccount", header: "Credit Account", render: (r) => r.creditAccount },
  { key: "principalAmount", header: "Principal", render: (r) => formatCurrency(r.principalAmount) },
  { key: "interestAmount", header: "Interest", render: (r) => formatCurrency(r.interestAmount) },
  { key: "penaltyAmount", header: "Penalty", render: (r) => formatCurrency(r.penaltyAmount) },
  { key: "totalAmount", header: "Total", render: (r) => <span className="font-medium">{formatCurrency(r.totalAmount)}</span> },
  { key: "remarks", header: "Remarks", render: (r) => r.remarks || <span className="text-slate-400">—</span> },
];

export function AccountingPage() {
  const [category, setCategory] = useState<AccountingCategory>("principal");
  const [filters, setFilters] = useState<AccountingFilters>({});
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["accounting", category, filters],
    queryFn: () => getAccountingEntries(category, filters),
  });

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(format);
    setExportError(null);
    try {
      await exportAccountingEntries(category, filters, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounting Export"
        description="Standardized double-entry accounting rows, ready for import into any ERP."
      />

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as AccountingCategory)}>
            {ACCOUNTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ACCOUNTING_CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectField>
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
          <TextField
            label="Loan Id (UUID)"
            placeholder="optional"
            value={filters.loanId ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, loanId: e.target.value || undefined }))}
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
        {data?.notes && (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{data.notes}</div>
        )}
      </Card>

      {isLoading && <LoadingState label="Loading accounting entries..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load entries."} />}
      {data && data.data.length === 0 && <EmptyState message="No entries match these filters." />}
      {data && data.data.length > 0 && (
        <Table columns={COLUMNS} rows={data.data} rowKey={(row) => `${row.referenceNumber}-${row.transactionDate}`} />
      )}
    </div>
  );
}
