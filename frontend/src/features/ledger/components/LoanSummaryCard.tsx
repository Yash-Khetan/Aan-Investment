import { Badge } from "../../../components/ui/Badge";
import { DetailField } from "../../../components/ui/SlideOver";
import { formatCurrency, formatDate, formatPercent } from "../../../lib/format";
import {
  ASSET_CLASSIFICATIONS,
  CIBIL_ACCOUNT_STATUSES,
  CIBIL_COLLATERAL_TYPES,
  CREDIT_TYPES,
  PAYMENT_FREQUENCIES,
} from "../../loans/types";
import type { Loan } from "../../loans/types";
import { CALCULATION_METHOD_OPTIONS, INTEREST_BASIS_OPTIONS } from "../../interest/types";
import { labelOf } from "./codedLabel";
import { SummaryCard, SummaryGroup } from "./summaryShared";

/** Falls back to the raw enum value for a basis retired from the picker but still configured. */
function optionLabel(options: readonly { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * The selected loan, read straight from the Loan module — the source of the
 * interest configuration this ledger accrues at. Read-only: rates and
 * day-count are changed in the Loan module, not here.
 */
export function LoanSummaryCard({ loan }: { loan: Loan }) {
  const config = loan.interestConfig ?? null;

  return (
    <SummaryCard
      title="Loan Details"
      badges={
        <>
          <Badge status={loan.classification} />
          <Badge status={loan.status} />
        </>
      }
    >
      <SummaryGroup title="Loan">
        <DetailField label="Loan Account Number" value={loan.loanAccountNumber} />
        <DetailField label="Loan Type" value={loan.loanType} />
        <DetailField label="Security Type" value={loan.securityType} />
        <DetailField label="Repayment Type" value={loan.repaymentType?.replace(/_/g, " ")} />
        <DetailField label="Interest Rate" value={`${Number(loan.interestRate).toFixed(2)}%`} />
        <DetailField label="TDS Rate" value={`${Number(loan.tdsRatePercent ?? 0).toFixed(2)}%`} />
      </SummaryGroup>

      <SummaryGroup title="Interest Configuration (in effect)">
        <DetailField label="Interest Basis" value={optionLabel(INTEREST_BASIS_OPTIONS, config?.interestBasis)} />
        <DetailField label="Method" value={optionLabel(CALCULATION_METHOD_OPTIONS, config?.calculationMethod)} />
        <DetailField
          label="Include Opening & Closing Days"
          value={config ? (config.includeOpeningClosingDays ? "Yes" : "No") : null}
        />
        <DetailField label="Effective From" value={formatDate(config?.effectiveFrom)} />
      </SummaryGroup>

      <SummaryGroup title="Amounts">
        <DetailField label="Sanctioned Amount" value={formatCurrency(loan.sanctionedAmount)} />
        <DetailField label="Disbursed" value={formatCurrency(loan.disbursedAmount)} />
        <DetailField label="Outstanding" value={formatCurrency(loan.outstandingPrincipal)} />
        <DetailField label="Amount Overdue" value={formatCurrency(loan.amountOverdue)} />
        <DetailField label="IRR (to date)" value={formatPercent(loan.irr)} />
      </SummaryGroup>

      <SummaryGroup title="Schedule & Dates">
        <DetailField label="Sanction Date" value={formatDate(loan.sanctionDate)} />
        <DetailField label="First Disbursement" value={formatDate(loan.firstDisbursementDate)} />
        <DetailField label="Maturity Date" value={formatDate(loan.maturityDate)} />
        <DetailField label="Tenure (months)" value={loan.tenureMonths} />
        <DetailField label="Next Due Date" value={formatDate(loan.nextDueDate)} />
        <DetailField label="DPD" value={loan.dpd} />
      </SummaryGroup>

      <SummaryGroup title="CIBIL Reporting">
        <DetailField label="Credit / Account Type" value={labelOf(CREDIT_TYPES, loan.creditType)} />
        <DetailField label="Account Status" value={labelOf(CIBIL_ACCOUNT_STATUSES, loan.cibilAccountStatus)} />
        <DetailField label="Account Classification" value={labelOf(ASSET_CLASSIFICATIONS, loan.assetClassification)} />
        <DetailField label="Payment Frequency" value={labelOf(PAYMENT_FREQUENCIES, loan.paymentFrequency)} />
        <DetailField label="EMI Amount" value={loan.emiAmount ? formatCurrency(loan.emiAmount) : null} />
        <DetailField label="Type of Collateral" value={labelOf(CIBIL_COLLATERAL_TYPES, loan.collateralType)} />
        <DetailField
          label="Value of Collateral"
          value={loan.collateralValue ? formatCurrency(loan.collateralValue) : null}
        />
      </SummaryGroup>

      {loan.purpose && (
        <SummaryGroup title="Notes">
          <div className="sm:col-span-2 lg:col-span-4">
            <DetailField label="Purpose" value={loan.purpose} />
          </div>
        </SummaryGroup>
      )}
    </SummaryCard>
  );
}
