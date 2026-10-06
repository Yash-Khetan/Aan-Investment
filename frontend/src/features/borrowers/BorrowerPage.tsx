import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { MoneyStrip } from "../../components/ui/MoneyStrip";
import { Table, type Column } from "../../components/ui/Table";
import { Tabs, useTab, type TabDef } from "../../components/ui/Tabs";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { ApiError } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { FIGURE } from "../../lib/glossary";
import { listLoans } from "../loans/api";
import type { Loan } from "../loans/types";
import { searchDocuments } from "../documents/api";
import { DocumentCard } from "../documents/components/DocumentCard";
import { deleteBorrower, getBorrower } from "./api";
import { BorrowerDetailView } from "./components/BorrowerDetailView";
import { BORROWER_TYPE_LABELS } from "./types";

type TabKey = "loans" | "profile" | "documents";

const TABS: TabDef<TabKey>[] = [
  { key: "loans", label: "Loans" },
  { key: "profile", label: "Profile" },
  { key: "documents", label: "Documents" },
];

const sum = (rows: Loan[], pick: (l: Loan) => number) => rows.reduce((acc, l) => acc + pick(l), 0);

/** One borrower: what they owe across all their loans, each loan, their profile and their documents. */
export function BorrowerPage() {
  const { id } = useParams<{ id: string }>();
  const borrowerId = id!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useTab(TABS);

  const borrower = useQuery({ queryKey: ["borrower", borrowerId], queryFn: () => getBorrower(borrowerId) });
  const loans = useQuery({
    queryKey: ["loans", { borrowerId }],
    queryFn: () => listLoans({ borrowerId, limit: 100 }),
  });

  const remove = useMutation({
    mutationFn: () => deleteBorrower(borrowerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["lookup"] });
      navigate("/borrowers");
    },
  });

  if (borrower.isLoading) return <LoadingState label="Loading borrower..." />;
  if (borrower.isError || !borrower.data) {
    return (
      <ErrorState message={borrower.error instanceof ApiError ? borrower.error.message : "Could not load this borrower."} />
    );
  }

  const b = borrower.data;
  const rows = loans.data?.data ?? [];
  const overdue = sum(rows, (l) => l.amountOverdue);

  const columns: Column<Loan>[] = [
    { key: "loan", header: "Loan", render: (l) => <span className="font-semibold text-slate-900">{l.loanAccountNumber}</span> },
    {
      key: "principal",
      header: FIGURE.principalOutstanding,
      align: "right",
      render: (l) => formatCurrency(l.snapshot.principalOutstanding),
      total: formatCurrency(sum(rows, (l) => l.snapshot.principalOutstanding)),
    },
    {
      key: "interest",
      header: FIGURE.interestDue,
      align: "right",
      render: (l) => formatCurrency(l.snapshot.interestOutstanding),
      total: formatCurrency(sum(rows, (l) => l.snapshot.interestOutstanding)),
    },
    {
      key: "payable",
      header: FIGURE.totalPayable,
      align: "right",
      render: (l) => <span className="font-semibold">{formatCurrency(l.snapshot.totalPayable)}</span>,
      total: formatCurrency(sum(rows, (l) => l.snapshot.totalPayable)),
    },
    {
      key: "overdue",
      header: FIGURE.overdue,
      align: "right",
      render: (l) =>
        l.amountOverdue > 0 ? <span className="font-semibold text-dr">{formatCurrency(l.amountOverdue)}</span> : <span className="text-slate-400">—</span>,
      total: formatCurrency(overdue),
    },
    { key: "dpd", header: FIGURE.dpd, align: "right", render: (l) => l.dpd },
    { key: "classification", header: FIGURE.classification, render: (l) => <Badge status={l.classification} /> },
    { key: "status", header: "Status", render: (l) => <Badge status={l.status} /> },
  ];

  return (
    <div>
      <PageHeader
        back={{ to: "/borrowers", label: "All borrowers" }}
        title={b.name}
        meta={<Badge status={b.status} />}
        description={`${BORROWER_TYPE_LABELS[b.borrowerType] ?? b.borrowerType} borrower, code ${b.borrowerCode}`}
        actions={
          <>
            <Link to={`/loans/new`}>
              <Button>New loan</Button>
            </Link>
            <Link to={`/borrowers/${borrowerId}/edit`}>
              <Button variant="secondary">Edit borrower</Button>
            </Link>
            <Button
              variant="ghost"
              className="text-dr"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete borrower ${b.name}? They will disappear from every list.`)) remove.mutate();
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      {remove.isError && (
        <div className="mb-4">
          <ErrorState message={remove.error instanceof Error ? remove.error.message : "Could not delete the borrower."} />
        </div>
      )}

      <div className="mb-6">
        <MoneyStrip
          figures={[
            { label: "Loans", value: String(rows.length) },
            { label: FIGURE.disbursed, value: formatCurrency(sum(rows, (l) => l.snapshot.totalDisbursed)) },
            { label: FIGURE.principalOutstanding, value: formatCurrency(sum(rows, (l) => l.snapshot.principalOutstanding)) },
            { label: FIGURE.totalPayable, value: formatCurrency(sum(rows, (l) => l.snapshot.totalPayable)) },
            {
              label: FIGURE.overdue,
              value: formatCurrency(overdue),
              tone: overdue > 0 ? "alert" : "muted",
              note: overdue > 0 ? "Across all their loans" : "Nothing overdue",
            },
          ]}
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "loans" && (
        <>
          {loans.isLoading && <LoadingState label="Loading loans..." />}
          {loans.data && rows.length === 0 && <EmptyState message="This borrower has no loans yet." />}
          {rows.length > 0 && (
            <Table columns={columns} rows={rows} rowKey={(l) => l.id} onRowClick={(l) => navigate(`/loans/${l.id}`)} />
          )}
        </>
      )}
      {tab === "profile" && <BorrowerDetailView borrowerId={borrowerId} showDocuments={false} />}
      {tab === "documents" && <BorrowerDocuments borrowerId={borrowerId} />}
    </div>
  );
}

/** The borrower's own documents (identity scans included) and those of each of their loans. */
function BorrowerDocuments({ borrowerId }: { borrowerId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents", "search", { borrowerId }],
    queryFn: () => searchDocuments({ borrowerId, limit: 100 }),
  });

  if (isLoading) return <LoadingState label="Loading documents..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Could not load documents."} />;
  if (!data || data.rows.length === 0) {
    return <EmptyState message="No documents yet. Upload them from the Documents page or a loan's Documents tab." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.rows.map((doc) => (
        <div key={doc.id}>
          <div className="mb-1 text-xs text-slate-500">
            {doc.loanAccountNumber ? `Loan ${doc.loanAccountNumber}` : "Borrower document"}
          </div>
          <DocumentCard doc={doc} />
        </div>
      ))}
    </div>
  );
}
