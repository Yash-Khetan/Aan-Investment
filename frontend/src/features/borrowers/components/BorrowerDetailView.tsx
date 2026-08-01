import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import { DetailField, DetailSection } from "../../../components/ui/SlideOver";
import { formatDate } from "../../../lib/format";
import { getBorrower } from "../api";
import { listDocuments, downloadDocument } from "../../documents/api";
import {
  ADDRESS_CATEGORIES,
  APPLICANT_TYPES,
  BORROWER_TYPE_LABELS,
  BUSINESS_CATEGORIES,
  BUSINESS_TYPES,
  GENDERS,
  OWNERSHIP_INDICATORS,
  RESIDENCE_CODES,
} from "../types";
import type { CodedOption } from "../types";

/** Show the CIBIL sheet's own wording for a coded value, falling back to the raw code. */
function labelOf(options: CodedOption[], value: string | null): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

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

  const isConsumer = borrower.borrowerType === "CONSUMER";

  return (
    <div>
      <div className="mb-6">
        <Badge status={borrower.status} />
      </div>

      <DetailSection title="Basic Details">
        <div className="col-span-2">
          <DetailField label="Borrower Type" value={BORROWER_TYPE_LABELS[borrower.borrowerType] ?? borrower.borrowerType} />
        </div>
        <DetailField label={isConsumer ? "Account Number" : "Borrower Code"} value={borrower.borrowerCode} />
        <DetailField label="Name" value={borrower.name} />
        {isConsumer ? (
          <>
            <DetailField label="Gender" value={labelOf(GENDERS, borrower.gender)} />
            <DetailField label="Date of Birth" value={formatDate(borrower.dateOfBirth)} />
          </>
        ) : (
          <>
            <DetailField label="Borrower Legal Constitution" value={borrower.constitution?.replace(/_/g, " ")} />
            <DetailField label="Applicant Type" value={labelOf(APPLICANT_TYPES, borrower.applicantType)} />
            <DetailField label="Date of Incorporation" value={formatDate(borrower.dateOfIncorporation)} />
            <DetailField label="Business Category" value={labelOf(BUSINESS_CATEGORIES, borrower.businessCategory)} />
            <DetailField label="Business Type" value={labelOf(BUSINESS_TYPES, borrower.businessType)} />
            <DetailField label="Class of Activity 1" value={borrower.classOfActivity1} />
          </>
        )}
      </DetailSection>

      <DetailSection title="Identity">
        {isConsumer ? (
          <>
            <DetailField label="Income Tax ID Number (PAN)" value={borrower.pan} />
            <DetailField label="Aadhaar" value={borrower.aadhaar} />
            <DetailField label="CKYC Number" value={borrower.ckycNumber} />
          </>
        ) : (
          <DetailField label="PAN" value={borrower.pan} />
        )}
      </DetailSection>

      <DetailSection title="Contact">
        <DetailField label={isConsumer ? "Email ID" : "Email"} value={borrower.email} />
        <DetailField label={isConsumer ? "Mobile No." : "Mobile"} value={borrower.phone} />
      </DetailSection>

      <DetailSection title={isConsumer ? "Address" : "Registered Address"}>
        <div className="col-span-2">
          <DetailField label="Address" value={borrower.addressLine1} />
        </div>
        {!isConsumer && (
          <>
            <DetailField label="City" value={borrower.city} />
            <DetailField label="District" value={borrower.district} />
          </>
        )}
        <DetailField label="State" value={borrower.state} />
        <DetailField label="Pincode" value={borrower.pincode} />
        {isConsumer && (
          <>
            <DetailField label="Address Category" value={labelOf(ADDRESS_CATEGORIES, borrower.addressCategory)} />
            <DetailField label="Residence Code" value={labelOf(RESIDENCE_CODES, borrower.residenceCode)} />
            <DetailField label="Ownership Indicator" value={labelOf(OWNERSHIP_INDICATORS, borrower.ownershipIndicator)} />
          </>
        )}
      </DetailSection>

      {!isConsumer && (
        <DetailSection title="Internal">
          <DetailField label="Internal Rating" value={borrower.internalRating} />
          <div className="col-span-2">
            <DetailField label="Rating Remarks" value={borrower.ratingRemarks} />
          </div>
          <div className="col-span-2">
            <DetailField label="Remarks" value={borrower.notes} />
          </div>
        </DetailSection>
      )}

      {borrower.promoters.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Related Persons</h3>
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
