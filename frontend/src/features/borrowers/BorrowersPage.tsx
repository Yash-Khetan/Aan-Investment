import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { SelectField } from "../../components/ui/Field";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { listBorrowers } from "./api";
import { BORROWER_TYPES, BORROWER_TYPE_LABELS } from "./types";
import type { Borrower, BorrowerType } from "./types";

/** Every borrower, one row each. Click a row to open the borrower and their loans. */
export function BorrowersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [borrowerType, setBorrowerType] = useState<BorrowerType | "">("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["borrowers", search, borrowerType],
    queryFn: () => listBorrowers({ search: search || undefined, borrowerType: borrowerType || undefined }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Borrower>[] = [
    {
      key: "name",
      header: "Borrower",
      render: (b) => (
        <div>
          <div className="font-semibold text-slate-900">{b.name}</div>
          <div className="text-xs text-slate-500">{b.borrowerCode}</div>
        </div>
      ),
    },
    { key: "borrowerType", header: "Type", render: (b) => BORROWER_TYPE_LABELS[b.borrowerType] ?? b.borrowerType },
    { key: "groupName", header: "Group", render: (b) => b.groupName ?? "—" },
    { key: "pan", header: "PAN", render: (b) => b.pan ?? "—" },
    { key: "phone", header: "Phone", render: (b) => b.phone ?? "—" },
    { key: "status", header: "Status", render: (b) => <Badge status={b.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Borrowers"
        actions={
          <Link to="/borrowers/new">
            <Button>New borrower</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-96">
          <label htmlFor="borrower-search" className="sr-only">
            Search borrowers
          </label>
          <input
            id="borrower-search"
            type="search"
            placeholder="Search by name, code, PAN or GST"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-56">
          <SelectField
            label="Type"
            value={borrowerType}
            onChange={(e) => setBorrowerType(e.target.value as BorrowerType | "")}
          >
            <option value="">All types</option>
            {BORROWER_TYPES.map((t) => (
              <option key={t} value={t}>
                {BORROWER_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {isLoading && <LoadingState label="Loading borrowers..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Could not load borrowers."} />}
      {data && data.data.length === 0 && (
        <EmptyState message={search ? "No borrower matches that search." : "No borrowers yet. Add the first one with New borrower."} />
      )}

      {data && data.data.length > 0 && (
        <Table columns={columns} rows={data.data} rowKey={(b) => b.id} onRowClick={(b) => navigate(`/borrowers/${b.id}`)} />
      )}
    </div>
  );
}
