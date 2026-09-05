import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { DetailField } from "../../../components/ui/SlideOver";
import { LoadingState, ErrorState } from "../../../components/ui/States";
import { Card } from "../../../components/ui/Card";
import { formatDate } from "../../../lib/format";
import { getBorrower } from "../../borrowers/api";
import {
  ADDRESS_CATEGORIES,
  APPLICANT_TYPES,
  BORROWER_TYPE_LABELS,
  BUSINESS_CATEGORIES,
  BUSINESS_TYPES,
  GENDERS,
  OWNERSHIP_INDICATORS,
  RESIDENCE_CODES,
} from "../../borrowers/types";
import { labelOf } from "./codedLabel";
import { SummaryCard, SummaryGroup } from "./summaryShared";

/**
 * The borrower behind the selected loan, read straight from the Borrower module.
 * Shares the ["borrower", id] query key with the Borrowers page, so both views
 * show the same record from the same cache. Purely read-only — editing a
 * borrower still happens in the Borrower module.
 */
export function BorrowerSummaryCard({ borrowerId }: { borrowerId: string }) {
  const { data: borrower, isLoading, isError, error } = useQuery({
    queryKey: ["borrower", borrowerId],
    queryFn: () => getBorrower(borrowerId),
    enabled: !!borrowerId,
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <LoadingState label="Loading borrower details..." />
      </Card>
    );
  }

  if (isError) {
    return <ErrorState message={error instanceof Error ? error.message : "Failed to load the borrower."} />;
  }

  if (!borrower) return null;

  const isConsumer = borrower.borrowerType === "CONSUMER";

  return (
    <SummaryCard
      title="Borrower Details"
      badges={<Badge status={borrower.status} />}
    >
      <SummaryGroup title="Basic Details">
        <DetailField
          label="Borrower Type"
          value={BORROWER_TYPE_LABELS[borrower.borrowerType] ?? borrower.borrowerType}
        />
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
      </SummaryGroup>

      <SummaryGroup title="Identity">
        {isConsumer ? (
          <>
            <DetailField label="Income Tax ID Number (PAN)" value={borrower.pan} />
            <DetailField label="Aadhaar" value={borrower.aadhaar} />
            <DetailField label="CKYC Number" value={borrower.ckycNumber} />
          </>
        ) : (
          <DetailField label="PAN" value={borrower.pan} />
        )}
      </SummaryGroup>

      <SummaryGroup title="Contact">
        <DetailField label={isConsumer ? "Email ID" : "Email"} value={borrower.email} />
        <DetailField label={isConsumer ? "Mobile No." : "Mobile"} value={borrower.phone} />
      </SummaryGroup>

      <SummaryGroup title={isConsumer ? "Address" : "Registered Address"}>
        <div className="sm:col-span-2">
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
      </SummaryGroup>

      {!isConsumer && (
        <SummaryGroup title="Internal">
          <DetailField label="Internal Rating" value={borrower.internalRating} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailField label="Rating Remarks" value={borrower.ratingRemarks} />
          </div>
        </SummaryGroup>
      )}

      {borrower.promoters.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Related Persons</h3>
          <div className="flex flex-wrap gap-2">
            {borrower.promoters.map((p) => (
              <div key={p.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{p.name}</span>{" "}
                {p.designation && <span className="text-slate-400">({p.designation})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </SummaryCard>
  );
}
