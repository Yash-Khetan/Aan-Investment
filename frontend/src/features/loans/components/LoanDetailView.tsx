import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import { DetailField, DetailSection } from "../../../components/ui/SlideOver";
import { formatCurrency, formatDate, formatPercent } from "../../../lib/format";
import { getLoan } from "../api";
import { listGuarantors } from "../../guarantors/api";
import { listDocuments, downloadDocument } from "../../documents/api";

/** Read-only loan summary shown in the View slide-over — the loan itself is locked once created. */
export function LoanDetailView({ loanId }: { loanId: string }) {
  const { data: loan, isLoading, isError, error } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => getLoan(loanId),
  });

  const { data: guarantors } = useQuery({
    queryKey: ["guarantors", loanId],
    queryFn: () => listGuarantors(loanId),
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", "LOAN", loanId],
    queryFn: () => listDocuments("LOAN", loanId),
  });

  if (isLoading) return <LoadingState label="Loading loan..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load loan."} />;
  if (!loan) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Badge status={loan.classification} />
        <Badge status={loan.status} />
      </div>

      <DetailSection title="Loan">
        <DetailField label="Account Number" value={loan.loanAccountNumber} />
        <DetailField label="Borrower" value={loan.borrowerName} />
        <DetailField label="Type" value={loan.loanType} />
        <DetailField label="Security Type" value={loan.securityType} />
        <DetailField label="Repayment Type" value={loan.repaymentType?.replace(/_/g, " ")} />
        <DetailField label="Interest Rate" value={`${Number(loan.interestRate).toFixed(2)}%`} />
      </DetailSection>

      <DetailSection title="Amounts">
        <DetailField label="Sanctioned" value={formatCurrency(loan.sanctionedAmount)} />
        <DetailField label="Disbursed" value={formatCurrency(loan.disbursedAmount)} />
        <DetailField label="Outstanding" value={formatCurrency(loan.outstandingPrincipal)} />
        <DetailField label="Amount Overdue" value={formatCurrency(loan.amountOverdue)} />
        <DetailField label="IRR (to date)" value={formatPercent(loan.irr)} />
      </DetailSection>

      <DetailSection title="Schedule & Dates">
        <DetailField label="DPD" value={loan.dpd} />
        <DetailField label="Next Due Date" value={formatDate(loan.nextDueDate)} />
        <DetailField label="Sanction Date" value={formatDate(loan.sanctionDate)} />
        <DetailField label="First Disbursement" value={formatDate(loan.firstDisbursementDate)} />
        <DetailField label="Maturity Date" value={formatDate(loan.maturityDate)} />
        <DetailField label="Tenure (months)" value={loan.tenureMonths} />
      </DetailSection>

      {loan.purpose && (
        <DetailSection title="Notes">
          <div className="col-span-2">
            <DetailField label="Purpose" value={loan.purpose} />
          </div>
        </DetailSection>
      )}

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Guarantors</h3>
        {guarantors && guarantors.length === 0 && <p className="text-sm text-slate-400">No guarantors on this loan.</p>}
        <div className="flex flex-col gap-2">
          {guarantors?.map((g) => (
            <div key={g.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{g.name}</span>{" "}
              <span className="text-slate-400">({g.guaranteeType})</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Documents</h3>
        {documents && documents.length === 0 && <EmptyState message="No documents uploaded yet." />}
        <div className="flex flex-col gap-2">
          {documents?.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm">
              <span className="truncate text-slate-700">{doc.name}</span>
              <button
                type="button"
                className="shrink-0 text-xs text-slate-500 underline"
                onClick={() => downloadDocument(doc.id, doc.fileName ?? doc.name)}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
