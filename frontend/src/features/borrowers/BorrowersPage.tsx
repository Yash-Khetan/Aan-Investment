import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { TextField } from "../../components/ui/Field";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { SlideOver } from "../../components/ui/SlideOver";
import { formatDate } from "../../lib/format";
import { useAuth } from "../auth/AuthContext";
import { deleteBorrower, listBorrowers } from "./api";
import { BorrowerDetailView } from "./components/BorrowerDetailView";
import type { Borrower } from "./types";

export function BorrowersPage() {
  const [search, setSearch] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["borrowers", search],
    queryFn: () => listBorrowers({ search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBorrower,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["borrowers"] }),
  });

  function handleDelete(b: Borrower) {
    if (window.confirm(`Delete borrower "${b.name}" (${b.borrowerCode})? This cannot be undone from the UI.`)) {
      deleteMutation.mutate(b.id);
    }
  }

  const columns: Column<Borrower>[] = [
    { key: "borrowerCode", header: "Code", render: (b) => b.borrowerCode },
    { key: "name", header: "Name", render: (b) => b.name },
    { key: "groupName", header: "Group", render: (b) => b.groupName ?? "—" },
    { key: "constitution", header: "Constitution", render: (b) => b.constitution.replace(/_/g, " ") },
    { key: "pan", header: "PAN", render: (b) => b.pan ?? "—" },
    { key: "status", header: "Status", render: (b) => <Badge status={b.status} /> },
    { key: "createdAt", header: "Created", render: (b) => formatDate(b.createdAt) },
    {
      key: "actions",
      header: "",
      render: (b) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setViewingId(b.id)}>
            View
          </Button>
          {isAdmin && (
            <Link to={`/borrowers/${b.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          )}
          <Button variant="danger" onClick={() => handleDelete(b)} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader title="Borrowers" description="Borrower master data — promoters and internal ratings." />

      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="w-80">
          <TextField label="Search" placeholder="Name, code, PAN, GST…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Link to="/borrowers/new">
          <Button>+ New Borrower</Button>
        </Link>
      </div>

      {isLoading && <LoadingState label="Loading borrowers..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load borrowers."} />}
      {deleteMutation.isError && (
        <div className="mb-4">
          <ErrorState
            message={deleteMutation.error instanceof Error ? deleteMutation.error.message : "Failed to delete borrower."}
          />
        </div>
      )}
      {data && data.data.length === 0 && <EmptyState message="No borrowers yet — create the first one." />}

      {data && data.data.length > 0 && <Table columns={columns} rows={data.data} rowKey={(b) => b.id} />}

      <SlideOver open={!!viewingId} title="Borrower Details" onClose={() => setViewingId(null)}>
        {viewingId && <BorrowerDetailView borrowerId={viewingId} />}
      </SlideOver>
    </div>
  );
}
