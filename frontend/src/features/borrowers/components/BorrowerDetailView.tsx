import { useQuery } from "@tanstack/react-query";
import { Panel, Facts, type Fact } from "../../../components/ui/Facts";
import { LoadingState, ErrorState } from "../../../components/ui/States";
import { formatDate } from "../../../lib/format";
import { getBorrower } from "../api";
import { viewIdentityDocument, type IdentityDocumentKind } from "../identityDocumentApi";
import {
  ADDRESS_CATEGORIES,
  APPLICANT_TYPES,
  BUSINESS_CATEGORIES,
  BUSINESS_TYPES,
  GENDERS,
  OWNERSHIP_INDICATORS,
  RELATED_PERSON_RELATIONSHIPS,
  RESIDENCE_CODES,
} from "../types";
import type { BorrowerDetail, CodedOption } from "../types";

/** Show the CIBIL sheet's own wording for a coded value, falling back to the raw code. */
function labelOf(options: CodedOption[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

const titleCase = (s: string | null | undefined) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null;

/** An identity number, with a link to its scan when one is attached. */
function IdentityValue({
  borrowerId,
  kind,
  number,
  scanName,
}: {
  borrowerId: string;
  kind: IdentityDocumentKind;
  number: string | null;
  scanName: string | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-3">
      <span>{number ?? <span className="text-slate-400">—</span>}</span>
      {scanName ? (
        <button
          type="button"
          className="text-xs font-normal text-accent hover:underline"
          onClick={() => void viewIdentityDocument(borrowerId, kind)}
        >
          View scan
        </button>
      ) : (
        <span className="text-xs font-normal text-slate-400">No scan</span>
      )}
    </span>
  );
}

/** Address lines joined the way they would be written on an envelope. */
function addressOf(b: BorrowerDetail): string | null {
  const cityLine = [b.city, b.district, b.state].filter(Boolean).join(", ");
  const parts = [b.addressLine1, [cityLine, b.pincode].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * The borrower's profile, grouped the way staff look things up: who they
 * are, how to prove it, how to reach them, and who stands behind them.
 * Read-only — changes go through Edit borrower.
 */
export function BorrowerDetailView({ borrowerId }: { borrowerId: string }) {
  const { data: b, isLoading, isError, error } = useQuery({
    queryKey: ["borrower", borrowerId],
    queryFn: () => getBorrower(borrowerId),
  });

  if (isLoading) return <LoadingState label="Loading profile..." />;
  if (isError || !b) return <ErrorState message={error instanceof Error ? error.message : "Could not load the profile."} />;

  const isConsumer = b.borrowerType === "CONSUMER";
  const address = addressOf(b);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={isConsumer ? "Personal details" : "Business details"}>
          <Facts
            rows={
              isConsumer
                ? [
                    ["Name", b.name],
                    ["Account number", b.borrowerCode],
                    ["Gender", labelOf(GENDERS, b.gender)],
                    ["Date of birth", b.dateOfBirth ? formatDate(b.dateOfBirth) : null],
                  ]
                : [
                    ["Legal name", b.name],
                    ["Borrower code", b.borrowerCode],
                    ["Group", b.groupName],
                    ["Constitution", titleCase(b.constitution)],
                    ["Applicant type", labelOf(APPLICANT_TYPES, b.applicantType)],
                    ["Incorporated on", b.dateOfIncorporation ? formatDate(b.dateOfIncorporation) : null],
                    ["Business category", labelOf(BUSINESS_CATEGORIES, b.businessCategory)],
                    ["Business type", labelOf(BUSINESS_TYPES, b.businessType)],
                    ["Activity", b.classOfActivity1],
                  ]
            }
          />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Identity">
            <Facts
              rows={[
                ["PAN", <IdentityValue key="pan" borrowerId={borrowerId} kind="pan" number={b.pan} scanName={b.panDocName} />],
                ...(isConsumer
                  ? ([
                      ["Aadhaar", <IdentityValue key="aadhaar" borrowerId={borrowerId} kind="aadhaar" number={b.aadhaar} scanName={b.aadhaarDocName} />],
                      ["CKYC number", <IdentityValue key="ckyc" borrowerId={borrowerId} kind="ckyc" number={b.ckycNumber} scanName={b.ckycDocName} />],
                    ] as Fact[])
                  : ([["GSTIN", b.gst]] as Fact[])),
              ]}
            />
          </Panel>

          <Panel title="Contact">
            <Facts
              rows={[
                ["Mobile", b.phone],
                ["Email", b.email],
                [isConsumer ? "Address" : "Registered address", address ? <span key="address" className="whitespace-pre-line">{address}</span> : null],
                ...(isConsumer
                  ? ([
                      ["Address type", labelOf(ADDRESS_CATEGORIES, b.addressCategory)],
                      ["Residence", labelOf(RESIDENCE_CODES, b.residenceCode)],
                      ["Ownership", labelOf(OWNERSHIP_INDICATORS, b.ownershipIndicator)],
                    ] as Fact[])
                  : []),
              ]}
            />
          </Panel>
        </div>
      </div>

      {!isConsumer && (
        <Panel title="Internal rating">
          <Facts
            rows={[
              ["Rating", b.internalRating],
              ["Rating remarks", b.ratingRemarks],
              ["Remarks", b.notes],
            ]}
          />
        </Panel>
      )}

      <Panel title="Related persons" aside={<span className="text-sm text-slate-500">{b.promoters.length}</span>}>
        {b.promoters.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">No promoters, directors or partners recorded.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600">
                  <th className="px-5 py-2">Name</th>
                  <th className="px-5 py-2">Relationship</th>
                  <th className="px-5 py-2">PAN</th>
                  <th className="px-5 py-2">Mobile</th>
                  <th className="px-5 py-2 text-right">Shareholding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b.promoters.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      {p.designation && <div className="text-xs text-slate-500">{p.designation}</div>}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700">{labelOf(RELATED_PERSON_RELATIONSHIPS, p.relationship) ?? "—"}</td>
                    <td className="px-5 py-2.5 text-slate-700">{p.pan ?? "—"}</td>
                    <td className="px-5 py-2.5 text-slate-700">{p.phone ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right text-slate-700">
                      {p.shareholdingPercent != null ? `${Number(p.shareholdingPercent)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
