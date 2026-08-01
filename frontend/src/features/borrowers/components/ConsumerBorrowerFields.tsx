import { Card } from "../../../components/ui/Card";
import { SelectField, TextField } from "../../../components/ui/Field";
import {
  ADDRESS_CATEGORIES,
  BORROWER_STATUSES,
  GENDERS,
  OWNERSHIP_INDICATORS,
  RESIDENCE_CODES,
  todayIso,
} from "../types";
import type { BorrowerFormState } from "../types";
import {
  AADHAAR_PATTERN,
  AADHAAR_TITLE,
  CKYC_PATTERN,
  CKYC_TITLE,
  ChooseOption,
  PAN_PATTERN,
  PAN_TITLE,
  PHONE_PATTERN,
  PHONE_TITLE,
  SectionTitle,
} from "./borrowerFormShared";

/**
 * Fields for an individual borrower — the Consumer sheet of the CIBIL workbook.
 * Rendered in place on the Borrower page when Borrower Type is CONSUMER.
 */
export function ConsumerBorrowerFields({
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Account Number"
            value={form.borrowerCode}
            onChange={(e) => onChange({ borrowerCode: e.target.value })}
            required
          />
          <TextField label="Consumer Name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} required />
          <SelectField label="Gender" value={form.gender} onChange={(e) => onChange({ gender: e.target.value })} required>
            <ChooseOption label="Gender" />
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Date of Birth"
            type="date"
            max={todayIso()}
            value={form.dateOfBirth}
            onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            required
          />
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

      <Card className="p-4">
        <SectionTitle>Identity</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Income Tax ID Number (PAN)"
            value={form.pan}
            onChange={(e) => onChange({ pan: e.target.value.toUpperCase() })}
            placeholder="AAAAA9999A"
            pattern={PAN_PATTERN}
            title={PAN_TITLE}
            required
          />
          <TextField
            label="Aadhaar"
            value={form.aadhaar}
            onChange={(e) => onChange({ aadhaar: e.target.value.replace(/\D/g, "") })}
            placeholder="123412341234"
            pattern={AADHAAR_PATTERN}
            title={AADHAAR_TITLE}
          />
          <TextField
            label="CKYC Number"
            value={form.ckycNumber}
            onChange={(e) => onChange({ ckycNumber: e.target.value.replace(/\D/g, "") })}
            placeholder="14-digit CKYC number"
            pattern={CKYC_PATTERN}
            title={CKYC_TITLE}
          />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Contact</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Email ID"
            type="email"
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            required
          />
          <TextField
            label="Mobile No."
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            pattern={PHONE_PATTERN}
            title={PHONE_TITLE}
            required
          />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Address</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Address"
            value={form.addressLine1}
            onChange={(e) => onChange({ addressLine1: e.target.value })}
            required
          />
          <TextField label="State" value={form.state} onChange={(e) => onChange({ state: e.target.value })} required />
          <TextField label="PIN Code" value={form.pincode} onChange={(e) => onChange({ pincode: e.target.value })} required />
          <SelectField
            label="Address Category"
            value={form.addressCategory}
            onChange={(e) => onChange({ addressCategory: e.target.value })}
            required
          >
            <ChooseOption label="Address Category" />
            {ADDRESS_CATEGORIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Residence Code"
            value={form.residenceCode}
            onChange={(e) => onChange({ residenceCode: e.target.value })}
            required
          >
            <ChooseOption label="Residence Code" />
            {RESIDENCE_CODES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Ownership Indicator"
            value={form.ownershipIndicator}
            onChange={(e) => onChange({ ownershipIndicator: e.target.value })}
            required
          >
            <ChooseOption label="Ownership Indicator" />
            {OWNERSHIP_INDICATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>
    </>
  );
}
