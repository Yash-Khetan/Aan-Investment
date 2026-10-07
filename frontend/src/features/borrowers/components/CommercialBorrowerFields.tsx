import { Card } from "../../../components/ui/Card";
import { IdentityFieldGroup } from "./IdentityFieldGroup";
import { SelectField, TextField } from "../../../components/ui/Field";
import {
  APPLICANT_TYPES,
  BORROWER_STATUSES,
  BUSINESS_CATEGORIES,
  BUSINESS_TYPES,
  CONSTITUTIONS,
  todayIso,
} from "../types";
import type { BorrowerFormState } from "../types";
import {
  CLASS_OF_ACTIVITY_PATTERN,
  CLASS_OF_ACTIVITY_TITLE,
  ChooseOption,
  PAN_PATTERN,
  PAN_TITLE,
  PHONE_PATTERN,
  PHONE_TITLE,
  SectionTitle,
} from "./borrowerFormShared";

export type BorrowerFormSection = "basic" | "identity" | "contact" | "address";

/**
 * Fields for a non-individual borrower (company, LLP, partnership firm, …) —
 * exactly the Commercial sheet of the CIBIL workbook, nothing more. Rendered in
 * place on the Borrower page when Borrower Type is COMMERCIAL.
 */
export function CommercialBorrowerFields({
  form,
  onChange,
  showStatus,
  section,
}: {
  form: BorrowerFormState;
  onChange: (patch: Partial<BorrowerFormState>) => void;
  showStatus?: boolean;
  /** Render only this part of the form (one step of a stepped form). Omitted: every part. */
  section?: BorrowerFormSection;
}) {
  const show = (part: BorrowerFormSection) => !section || section === part;
  return (
    <>
      {show("basic") && (
      <Card className="p-4">
        {!section && <SectionTitle>Basic Details</SectionTitle>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Account Number"
            value={form.borrowerCode}
            onChange={(e) => onChange({ borrowerCode: e.target.value })}
            required
          />
          <TextField label="Borrower Name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} required />
          <SelectField
            label="Borrower Legal Constitution"
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
          <TextField
            label="Date of Incorporation"
            type="date"
            max={todayIso()}
            value={form.dateOfIncorporation}
            onChange={(e) => onChange({ dateOfIncorporation: e.target.value })}
            required
          />
          <SelectField
            label="Business Category"
            value={form.businessCategory}
            onChange={(e) => onChange({ businessCategory: e.target.value })}
            required
          >
            <ChooseOption label="Business Category" />
            {BUSINESS_CATEGORIES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Business Type"
            value={form.businessType}
            onChange={(e) => onChange({ businessType: e.target.value })}
            required
          >
            <ChooseOption label="Business Type" />
            {BUSINESS_TYPES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Class of Activity 1"
            value={form.classOfActivity1}
            onChange={(e) => onChange({ classOfActivity1: e.target.value.replace(/\D/g, "") })}
            placeholder="5-digit code"
            pattern={CLASS_OF_ACTIVITY_PATTERN}
            title={CLASS_OF_ACTIVITY_TITLE}
            required
          />
          <SelectField
            label="Borrower Type (Applicant / Co-Applicant)"
            value={form.applicantType}
            onChange={(e) => onChange({ applicantType: e.target.value })}
            required
          >
            <ChooseOption label="Applicant Type" />
            {APPLICANT_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
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
        </div>
      </Card>
      )}

      {show("identity") && (
      <Card className="p-4">
        {!section && <SectionTitle>Identity</SectionTitle>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <IdentityFieldGroup
            heading="PAN"
            kind="pan"
            required
            value={form.pan}
            onValueChange={(v) => onChange({ pan: v.toUpperCase() })}
            inputProps={{ placeholder: "AAAAA9999A", pattern: PAN_PATTERN, title: PAN_TITLE }}
          />
        </div>
      </Card>
      )}

      {show("contact") && (
      <Card className="p-4">
        {!section && <SectionTitle>Contact</SectionTitle>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Email ID"
            type="email"
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            required
          />
          <TextField
            label="Mobile"
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            pattern={PHONE_PATTERN}
            title={PHONE_TITLE}
            required
          />
        </div>
      </Card>
      )}

      {show("address") && (
      <Card className="p-4">
        {!section && <SectionTitle>Registered Address</SectionTitle>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Address Line 1"
            value={form.addressLine1}
            onChange={(e) => onChange({ addressLine1: e.target.value })}
            required
          />
          <TextField label="City" value={form.city} onChange={(e) => onChange({ city: e.target.value })} required />
          <TextField label="District" value={form.district} onChange={(e) => onChange({ district: e.target.value })} required />
          <TextField label="State" value={form.state} onChange={(e) => onChange({ state: e.target.value })} required />
          <TextField label="Pin Code" value={form.pincode} onChange={(e) => onChange({ pincode: e.target.value })} required />
        </div>
      </Card>
      )}
    </>
  );
}
