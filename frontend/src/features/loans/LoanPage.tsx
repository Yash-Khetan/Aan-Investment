import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { MoneyStrip, type MoneyFigure } from "../../components/ui/MoneyStrip";
import { Tabs, useTab, type TabDef } from "../../components/ui/Tabs";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { ApiError } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/format";
import { FIGURE } from "../../lib/glossary";
import { deleteLoan, getLoan } from "./api";
import { LoanOverviewTab } from "./components/LoanOverviewTab";
import { LoanLedgerTab } from "./components/LoanLedgerTab";
import { LoanDpdTab } from "./components/LoanDpdTab";
import { LoanDocumentsTab } from "./components/LoanDocumentsTab";
import { LoanHistoryTab } from "./components/LoanHistoryTab";
import { LoanCollateral } from "../collateral/components/LoanCollateral";
import { GuarantorsSection } from "../guarantors/components/GuarantorsSection";
import type { Loan } from "./types";

type TabKey = "overview" | "ledger" | "dpd" | "documents" | "collateral" | "guarantors" | "history";

const TABS: TabDef<TabKey>[] = [
  { key: "overview", label: "Overview" },
  { key: "ledger", label: "Ledger" },
  { key: "dpd", label: "DPD history" },
  { key: "documents", label: "Documents" },
  { key: "collateral", label: "Collateral" },
  { key: "guarantors", label: "Guarantors" },
  { key: "history", label: "Imported history" },
];

/** The loan's headline figures — the same six, in the same words, on every tab. */
function loanFigures(loan: Loan): MoneyFigure[] {
  const s = loan.snapshot;
  const isOverdue = s.amountOverdue > 0;
  return [
    { label: FIGURE.disbursed, value: formatCurrency(s.totalDisbursed), note: s.firstDisbursementDate ? `First on ${formatDate(s.firstDisbursementDate)}` : "Nothing yet" },
    { label: FIGURE.received, value: formatCurrency(s.totalReceived), note: s.lastReceiptDate ? `Last on ${formatDate(s.lastReceiptDate)}` : "Nothing yet" },
    { label: FIGURE.principalOutstanding, value: formatCurrency(s.principalOutstanding) },
    { label: FIGURE.interestDue, value: formatCurrency(s.interestOutstanding), note: "After TDS" },
    { label: FIGURE.totalPayable, value: formatCurrency(s.totalPayable), note: "Principal + interest due" },
    {
      label: FIGURE.overdue,
      value: formatCurrency(s.amountOverdue),
      tone: isOverdue ? "alert" : "muted",
      note: isOverdue ? `${s.dpd} days past due` : "Nothing overdue",
    },
  ];
}

/**
 * One loan, everything about it on one page: the headline figures always in
 * view at the top, and its ledger, DPD history, documents, collateral,
 * guarantors and imported history as tabs below.
 */
export function LoanPage() {
  const { id } = useParams<{ id: string }>();
  const loanId = id!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useTab(TABS);

  const { data: loan, isLoading, isError, error } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => getLoan(loanId),
  });

  const remove = useMutation({
    mutationFn: () => deleteLoan(loanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["lookup"] });
      navigate("/loans");
    },
  });

  if (isLoading) return <LoadingState label="Loading loan..." />;
  if (isError || !loan) {
    return <ErrorState message={error instanceof ApiError ? error.message : "Could not load this loan."} />;
  }

  return (
    <div>
      <PageHeader
        back={{ to: "/loans", label: "All loans" }}
        title={loan.loanAccountNumber}
        meta={
          <>
            <Badge status={loan.classification} />
            <Badge status={loan.status} />
          </>
        }
        description={
          <>
            <Link to={`/borrowers/${loan.borrowerId}`} className="font-medium text-accent hover:underline">
              {loan.borrowerName ?? "Borrower"}
            </Link>
            {loan.nextDueDate && (
              <span className="ml-4 text-slate-500">
                {FIGURE.nextDue} {formatDate(loan.nextDueDate)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Link to={`/loans/${loanId}/edit`}>
              <Button variant="secondary">Edit loan</Button>
            </Link>
            <Button
              variant="ghost"
              className="text-dr"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete loan ${loan.loanAccountNumber}? It will disappear from every list.`)) {
                  remove.mutate();
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      {remove.isError && (
        <div className="mb-4">
          <ErrorState message={remove.error instanceof Error ? remove.error.message : "Could not delete the loan."} />
        </div>
      )}

      <div className="mb-6">
        <MoneyStrip figures={loanFigures(loan)} />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <LoanOverviewTab loan={loan} />}
      {tab === "ledger" && <LoanLedgerTab loanId={loanId} />}
      {tab === "dpd" && <LoanDpdTab loanId={loanId} />}
      {tab === "documents" && <LoanDocumentsTab loanId={loanId} />}
      {tab === "collateral" && <LoanCollateral loanId={loanId} isUnsecured={loan.loanType === "UNSECURED"} />}
      {tab === "guarantors" && <GuarantorsSection loanId={loanId} />}
      {tab === "history" && <LoanHistoryTab loan={loan} />}
    </div>
  );
}
