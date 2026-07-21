import { Card } from "../../../components/ui/Card";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { BORROWER_STATUSES, CONSTITUTIONS } from "../types";
import type { BorrowerFormState } from "../types";

/** Matches the backend's Indian-mobile format (an optional +91 prefix, then a 10-digit number starting 6-9). */
export const PHONE_PATTERN = "^(\\+91[- ]?)?[6-9][0-9]{9}$";
export const PHONE_TITLE = "Enter a valid 10-digit Indian mobile number, e.g. 9876543210 or +91 9876543210";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/** Borrower master-data fields shared by the create and edit pages. Promoters are handled separately (create only — the backend has no update endpoint for them yet). Guarantors now belong to loans, not borrowers. */
export function BorrowerMasterFields({
  form,
  onChange,
  showStatus,
}: {
  form: BorrowerFormState;
  onChange: (patch: Partial<BorrowerFormState>) => void;
  showStatus?: boolean;
}) {
  return (
    <>
      <Card className="p-4">
        <SectionTitle>Basic Details</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField
            label="Borrower Code"
            value={form.borrowerCode}
            onChange={(e) => onChange({ borrowerCode: e.target.value })}
            required
          />
          <TextField label="Borrower Name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} required />
          <TextField label="Group Name" value={form.groupName} onChange={(e) => onChange({ groupName: e.target.value })} />
          <SelectField
            label="Constitution"
            value={form.constitution}
            onChange={(e) => onChange({ constitution: e.target.value })}
            required
          >
            {CONSTITUTIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          {showStatus && (
            <SelectField label="Status" value={form.status} onChange={(e) => onChange({ status: e.target.value })} required>
              {BORROWER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            label="PAN"
            value={form.pan}
            onChange={(e) => onChange({ pan: e.target.value.toUpperCase() })}
            placeholder="AAAAA9999A"
          />
          <TextField label="GSTIN" value={form.gst} onChange={(e) => onChange({ gst: e.target.value.toUpperCase() })} />
          <TextField label="CIN" value={form.cin} onChange={(e) => onChange({ cin: e.target.value.toUpperCase() })} />
          <TextField
            label="Date of Incorporation"
            type="date"
            value={form.dateOfIncorporation}
            onChange={(e) => onChange({ dateOfIncorporation: e.target.value })}
          />
          <TextField
            label="Industry / Nature of Business"
            value={form.natureOfBusiness}
            onChange={(e) => onChange({ natureOfBusiness: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Contact</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField label="Email" type="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} />
          <TextField
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            pattern={PHONE_PATTERN}
            title={PHONE_TITLE}
          />
          <TextField
            label="Alternate Phone"
            type="tel"
            value={form.alternatePhone}
            onChange={(e) => onChange({ alternatePhone: e.target.value })}
            pattern={PHONE_PATTERN}
            title={PHONE_TITLE}
          />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Registered Address</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField label="Address Line 1" value={form.addressLine1} onChange={(e) => onChange({ addressLine1: e.target.value })} />
          <TextField label="Address Line 2" value={form.addressLine2} onChange={(e) => onChange({ addressLine2: e.target.value })} />
          <TextField label="City" value={form.city} onChange={(e) => onChange({ city: e.target.value })} />
          <TextField label="State" value={form.state} onChange={(e) => onChange({ state: e.target.value })} />
          <TextField label="Pincode" value={form.pincode} onChange={(e) => onChange({ pincode: e.target.value })} />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Internal</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField label="Internal Rating" value={form.internalRating} onChange={(e) => onChange({ internalRating: e.target.value })} />
          <TextAreaField
            label="Rating Remarks"
            value={form.ratingRemarks}
            onChange={(e) => onChange({ ratingRemarks: e.target.value })}
          />
          <TextAreaField label="Remarks" value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </div>
      </Card>
    </>
  );
}
