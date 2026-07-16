import { Card } from "../../../components/ui/Card";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { BorrowerSelect } from "../../lookup/BorrowerSelect";
import { LOAN_STATUSES, LOAN_TYPES, REPAYMENT_TYPES, SECURITY_TYPES } from "../types";
import type { LoanFormState } from "../types";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/** Loan master-data fields shared by the create and edit pages. */
export function LoanMasterFields({
  form,
  onChange,
  lockedBorrowerLabel,
}: {
  form: LoanFormState;
  onChange: (patch: Partial<LoanFormState>) => void;
  /** On edit, the borrower a loan belongs to isn't changeable — pass a display label to show it read-only instead of the picker. */
  lockedBorrowerLabel?: string;
}) {
  return (
    <>
      <Card className="p-4">
        <SectionTitle>Basic Details</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField
            label="Loan Account Number"
            value={form.loanAccountNumber}
            onChange={(e) => onChange({ loanAccountNumber: e.target.value })}
            required
          />
          <div className="lg:col-span-2">
            {lockedBorrowerLabel !== undefined ? (
              <TextField
                label="Borrower"
                value={lockedBorrowerLabel}
                disabled
                title="The borrower on a loan can't be changed after creation."
              />
            ) : (
              <BorrowerSelect value={form.borrowerId} onChange={(v) => onChange({ borrowerId: v })} required />
            )}
          </div>
          <SelectField label="Loan Type" value={form.loanType} onChange={(e) => onChange({ loanType: e.target.value })} required>
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <SelectField label="Security Type" value={form.securityType} onChange={(e) => onChange({ securityType: e.target.value })}>
            {SECURITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Repayment Type"
            value={form.repaymentType}
            onChange={(e) => onChange({ repaymentType: e.target.value })}
            required
          >
            {REPAYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          {/* <SelectField label="Status" value={form.status} onChange={(e) => onChange({ status: e.target.value })}>
            {LOAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField> */}
          {/* intentionally removed since the default loan status has to active and the user should not be able to create it in the first place  */}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Amounts &amp; Interest</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField
            label="Sanctioned Amount (INR)"
            type="number"
            min="0"
            step="0.01"
            value={form.sanctionedAmount}
            onChange={(e) => onChange({ sanctionedAmount: e.target.value })}
            required
          />
          <TextField
            label="Disbursed Amount (INR)"
            type="number"
            min="0"
            step="0.01"
            value={form.disbursedAmount}
            onChange={(e) => onChange({ disbursedAmount: e.target.value })}
          />
          <TextField
            label="Outstanding Principal (INR)"
            type="number"
            min="0"
            step="0.01"
            value={form.outstandingPrincipal}
            onChange={(e) => onChange({ outstandingPrincipal: e.target.value })}
          />
          <TextField
            label="Interest Rate (% p.a.)"
            type="number"
            min="0"
            step="0.01"
            value={form.interestRate}
            onChange={(e) => onChange({ interestRate: e.target.value })}
            required
          />
          <TextField
            label="Tenure (months)"
            type="number"
            min="1"
            step="1"
            value={form.tenureMonths}
            onChange={(e) => onChange({ tenureMonths: e.target.value })}
            required
          />
          <TextField
            label="Moratorium (months)"
            type="number"
            min="0"
            step="1"
            value={form.moratoriumMonths}
            onChange={(e) => onChange({ moratoriumMonths: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Key Dates</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField label="Sanction Date" type="date" value={form.sanctionDate} onChange={(e) => onChange({ sanctionDate: e.target.value })} />
          <TextField
            label="First Disbursement Date"
            type="date"
            value={form.firstDisbursementDate}
            onChange={(e) => onChange({ firstDisbursementDate: e.target.value })}
          />
          <TextField label="Maturity Date" type="date" value={form.maturityDate} onChange={(e) => onChange({ maturityDate: e.target.value })} />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Purpose &amp; Notes</SectionTitle>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <TextAreaField label="Purpose" value={form.purpose} onChange={(e) => onChange({ purpose: e.target.value })} />
          <TextAreaField label="Approval Notes" value={form.approvalNotes} onChange={(e) => onChange({ approvalNotes: e.target.value })} />
          <TextAreaField label="Remarks" value={form.remarks} onChange={(e) => onChange({ remarks: e.target.value })} />
        </div>
      </Card>
    </>
  );
}
