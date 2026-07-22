import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import { DetailField, DetailSection } from "../../../components/ui/SlideOver";
import { formatDate } from "../../../lib/format";
import { getBorrower } from "../api";
import { listDocuments, downloadDocument } from "../../documents/api";

/** Read-only borrower summary shown in the View slide-over — the borrower itself is locked once created. */
export function BorrowerDetailView({ borrowerId }: { borrowerId: string }) {
  const { data: borrower, isLoading, isError, error } = useQuery({
    queryKey: ["borrower", borrowerId],
    queryFn: () => getBorrower(borrowerId),
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", "BORROWER", borrowerId],
    queryFn: () => listDocuments("BORROWER", borrowerId),
  });

  if (isLoading) return <LoadingState label="Loading borrower..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load borrower."} />;
  if (!borrower) return null;

  return (
    <div>
      <div className="mb-6">
        <Badge status={borrower.status} />
      </div>

      <DetailSection title="Basic Details">
        <DetailField label="Borrower Code" value={borrower.borrowerCode} />
        <DetailField label="Name" value={borrower.name} />
        <DetailField label="Group Name" value={borrower.groupName} />
        <DetailField label="Constitution" value={borrower.constitution?.replace(/_/g, " ")} />
        <DetailField label="Date of Incorporation" value={formatDate(borrower.dateOfIncorporation)} />
        <DetailField label="Nature of Business" value={borrower.natureOfBusiness} />
      </DetailSection>

      <DetailSection title="Identity">
        <DetailField label="PAN" value={borrower.pan} />
        <DetailField label="GSTIN" value={borrower.gst} />
        <DetailField label="CIN" value={borrower.cin} />
        <DetailField label="Aadhaar" value={borrower.aadhaar} />
      </DetailSection>

      <DetailSection title="Contact">
        <DetailField label="Email" value={borrower.email} />
        <DetailField label="Phone" value={borrower.phone} />
        <DetailField label="Alternate Phone" value={borrower.alternatePhone} />
      </DetailSection>

      <DetailSection title="Registered Address">
        <div className="col-span-2">
          <DetailField
            label="Address"
            value={[borrower.addressLine1, borrower.addressLine2].filter(Boolean).join(", ") || null}
          />
        </div>
        <DetailField label="City" value={borrower.city} />
        <DetailField label="State" value={borrower.state} />
        <DetailField label="Pincode" value={borrower.pincode} />
      </DetailSection>

      <DetailSection title="Internal">
        <DetailField label="Internal Rating" value={borrower.internalRating} />
        <div className="col-span-2">
          <DetailField label="Rating Remarks" value={borrower.ratingRemarks} />
        </div>
        <div className="col-span-2">
          <DetailField label="Remarks" value={borrower.notes} />
        </div>
      </DetailSection>

      {borrower.promoters.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Promoters</h3>
          <div className="flex flex-col gap-2">
            {borrower.promoters.map((p) => (
              <div key={p.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{p.name}</span>{" "}
                {p.designation && <span className="text-slate-400">({p.designation})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

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
