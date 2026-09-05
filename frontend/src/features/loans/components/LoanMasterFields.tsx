import { Card } from "../../../components/ui/Card";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { BorrowerSelect } from "../../lookup/BorrowerSelect";
import {
  CALCULATION_METHOD_OPTIONS,
  INCLUDE_OPENING_CLOSING_DAYS_OPTIONS,
  INTEREST_BASIS_OPTIONS,
  RUNNING_BALANCE_UNSUPPORTED_BASES,
} from "../../interest/types";
import type { InterestBasis } from "../../interest/types";
import {
  CIBIL_COLLATERAL_TYPES,
  CREDIT_TYPES,
  LOAN_TYPES,
  PAYMENT_FREQUENCIES,
  REPAYMENT_TYPES,
  SECURITY_TYPES,
  calcTenureMonths,
} from "../types";
import type { CodedOption, LoanFormState } from "../types";

const MORATORIUM_TOOLTIP =
  "Moratorium Period means the period during which no payments are collected from the borrower. However, interest continues to accrue during this period.";

const TDS_RATE_TOOLTIP =
  "Tax deducted at source, as a percentage of the interest accrued. The Ledger uses this rate when it generates each month's TDS entry.";

const EFFECTIVE_FROM_TOOLTIP =
  "The date this interest configuration takes effect. Periods already calculated under an earlier configuration keep it — set a later date here to change the rates from that point on without disturbing what came before.";

/** Switching to Running Balance drops a basis it can't express back to the default. */
function methodChange(method: string, currentBasis: string): Partial<LoanFormState> {
  const invalid =
    method === "RUNNING_BALANCE" && RUNNING_BALANCE_UNSUPPORTED_BASES.includes(currentBasis as InterestBasis);
  return invalid
    ? { calculationMethod: method, interestBasis: "ACTUAL_365", customFormula: "" }
    : { calculationMethod: method };
}

/** A formula belongs only to the CUSTOM basis; leaving it behind would be saved and never used. */
function clearedFormula(basis: string): Partial<LoanFormState> {
  return basis === "CUSTOM" ? {} : { customFormula: "" };
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/** A coded CIBIL dropdown, blank until the user picks a value. */
function CodedSelect({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: CodedOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">— Select {label} —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </SelectField>
  );
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
  const tenureMonths = calcTenureMonths(form.firstDisbursementDate, form.maturityDate);
  // Running Balance Method has no daily-rate concept for FULL_MONTH/CUSTOM, so
  // those aren't offered alongside it — same rule the Interest module applies.
  const basisOptions =
    form.calculationMethod === "RUNNING_BALANCE"
      ? INTEREST_BASIS_OPTIONS.filter((o) => !RUNNING_BALANCE_UNSUPPORTED_BASES.includes(o.value))
      : INTEREST_BASIS_OPTIONS;
  /** Drives both the disabled state and the required flag on Value of Collateral. */
  const noCollateral = form.collateralType === "NO_COLLATERAL";

  return (
    <>
      <Card className="p-4">
        <SectionTitle>Basic Details</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <SelectField
            label="Loan Type"
            value={form.loanType}
            onChange={(e) => {
              const loanType = e.target.value;
              onChange(
                loanType === "UNSECURED"
                  ? { loanType, securityType: "NONE", otherSecurityType: "" }
                  : { loanType },
              );
            }}
            required
          >
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          {form.loanType !== "UNSECURED" && (
            <SelectField
              label="Security Type"
              value={form.securityType}
              onChange={(e) => onChange({ securityType: e.target.value, otherSecurityType: "" })}
            >
              {SECURITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </SelectField>
          )}
          {form.loanType !== "UNSECURED" && form.securityType === "OTHERS" && (
            <TextField
              label="Specify Security Type"
              value={form.otherSecurityType}
              onChange={(e) => onChange({ otherSecurityType: e.target.value })}
              required
            />
          )}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            label="Interest Rate (% p.a.)"
            type="number"
            min="0"
            step="0.01"
            value={form.interestRate}
            onChange={(e) => onChange({ interestRate: e.target.value })}
            required
          />
          <TextField
            label="TDS Rate (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.tdsRatePercent}
            onChange={(e) => onChange({ tdsRatePercent: e.target.value })}
            tooltip={TDS_RATE_TOOLTIP}
          />
          <TextField
            label="Moratorium (months)"
            type="number"
            min="0"
            step="1"
            value={form.moratoriumMonths}
            onChange={(e) => onChange({ moratoriumMonths: e.target.value })}
            tooltip={MORATORIUM_TOOLTIP}
          />
          <SelectField
            label="Interest Calculation Method"
            value={form.calculationMethod}
            onChange={(e) => onChange(methodChange(e.target.value, form.interestBasis))}
          >
            {CALCULATION_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Interest Basis (Day Count)"
            value={form.interestBasis}
            onChange={(e) => onChange({ interestBasis: e.target.value, ...clearedFormula(e.target.value) })}
            required
          >
            {basisOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Include Opening & Closing Days"
            value={form.includeOpeningClosingDays}
            onChange={(e) => onChange({ includeOpeningClosingDays: e.target.value })}
          >
            {INCLUDE_OPENING_CLOSING_DAYS_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value ? "yes" : "no"}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Interest Effective From"
            type="date"
            value={form.interestEffectiveFrom}
            onChange={(e) => onChange({ interestEffectiveFrom: e.target.value })}
            tooltip={EFFECTIVE_FROM_TOOLTIP}
          />
          {form.interestBasis === "CUSTOM" && (
            <div className="sm:col-span-2 lg:col-span-3">
              <TextAreaField
                label="Custom Formula"
                value={form.customFormula}
                onChange={(e) => onChange({ customFormula: e.target.value })}
                placeholder="e.g. principal * rate * days / 365"
                required
              />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          These are the loan&apos;s interest settings. Saving them makes them the current configuration for this loan
          &mdash; the Interest engine, Repayment schedule and Ledger all calculate from them. Already-posted Ledger
          entries keep the configuration they were calculated under.
        </p>
      </Card>

      <Card className="p-4">
        <SectionTitle>Key Dates</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Sanction Date" type="date" value={form.sanctionDate} onChange={(e) => onChange({ sanctionDate: e.target.value })} />
          <TextField
            label="First Disbursement Date"
            type="date"
            value={form.firstDisbursementDate}
            onChange={(e) => onChange({ firstDisbursementDate: e.target.value })}
            required
          />
          <TextField
            label="Maturity Date"
            type="date"
            value={form.maturityDate}
            onChange={(e) => onChange({ maturityDate: e.target.value })}
            required
          />
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Tenure (auto-calculated)</div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700">
              {tenureMonths > 0 ? `${tenureMonths} month${tenureMonths === 1 ? "" : "s"}` : "Maturity Date - Sanction Date"}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>CIBIL Reporting</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CodedSelect
            label="Credit Type / Account Type"
            options={CREDIT_TYPES}
            value={form.creditType}
            onChange={(v) => onChange({ creditType: v })}
            required
          />
          <CodedSelect
            label="Payment Frequency"
            options={PAYMENT_FREQUENCIES}
            value={form.paymentFrequency}
            onChange={(v) => onChange({ paymentFrequency: v })}
            required
          />
          <TextField
            label="EMI Amount"
            type="number"
            min="0"
            step="0.01"
            value={form.emiAmount}
            onChange={(e) => onChange({ emiAmount: e.target.value })}
            required
          />
          <CodedSelect
            label="Type of Collateral"
            options={CIBIL_COLLATERAL_TYPES}
            value={form.collateralType}
            onChange={(v) => onChange({ collateralType: v })}
            required
          />
          <TextField
            label="Value of Collateral"
            type="number"
            min="0"
            step="0.01"
            value={form.collateralValue}
            onChange={(e) => onChange({ collateralValue: e.target.value })}
            disabled={noCollateral}
            /* A loan with no collateral has no value to state, so the field is
               disabled and cannot be required - requiring it would make such a
               loan impossible to save. */
            required={!noCollateral}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Reported to CIBIL. Separate from Loan Type, Status and Repayment Type above, which drive the app's own workflow.
        </p>
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
