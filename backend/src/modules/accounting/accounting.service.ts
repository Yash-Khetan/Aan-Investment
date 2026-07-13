import { createJournalEntry, getJournalEntriesForLoan } from "./accounting.repository";

/**
 * Records a loan disbursement as a journal entry.
 * Called by the Loan module (Dev A's) when a loan is disbursed.
 */
export async function recordDisbursement(loanId: string, amount: number, entryDate: string) {
  return createJournalEntry({
    loanId,
    entryType: "DISBURSEMENT",
    entryDate,
    amount,
    narration: `Loan disbursement for loan ${loanId}`,
  });
}

/**
 * Records daily/periodic interest accrual — a non-cash entry recognizing
 * interest earned but not yet collected. Called by the Interest Engine's
 * service after each interest calculation run.
 */
export async function recordInterestAccrual(loanId: string, amount: number, entryDate: string) {
  if (amount <= 0) return null; // no accrual to record
  return createJournalEntry({
    loanId,
    entryType: "INTEREST_ACCRUAL",
    entryDate,
    amount,
    narration: `Interest accrued for loan ${loanId}`,
  });
}

/**
 * Records a payment's interest/principal/penalty components as separate
 * journal entries. Called by the Payment Engine's recordPayment() after
 * a payment's waterfall allocation is determined.
 */
export async function recordPaymentEntries(input: {
  loanId: string;
  paymentId: string;
  entryDate: string;
  principalApplied: number;
  interestApplied: number;
  penaltyApplied: number;
}) {
  const entries = [];

  if (input.principalApplied > 0) {
    entries.push(
      await createJournalEntry({
        loanId: input.loanId,
        paymentId: input.paymentId,
        entryType: "PRINCIPAL_RECEIPT",
        entryDate: input.entryDate,
        amount: input.principalApplied,
        narration: `Principal received for loan ${input.loanId}`,
      })
    );
  }

  if (input.interestApplied > 0) {
    entries.push(
      await createJournalEntry({
        loanId: input.loanId,
        paymentId: input.paymentId,
        entryType: "INTEREST_RECEIPT",
        entryDate: input.entryDate,
        amount: input.interestApplied,
        narration: `Interest received for loan ${input.loanId}`,
      })
    );
  }

  if (input.penaltyApplied > 0) {
    entries.push(
      await createJournalEntry({
        loanId: input.loanId,
        paymentId: input.paymentId,
        entryType: "PENAL_INTEREST",
        entryDate: input.entryDate,
        amount: input.penaltyApplied,
        narration: `Penal interest received for loan ${input.loanId}`,
      })
    );
  }

  return entries;
}

/**
 * Records a loan write-off.
 */
export async function recordWriteOff(loanId: string, amount: number, entryDate: string) {
  return createJournalEntry({
    loanId,
    entryType: "WRITE_OFF",
    entryDate,
    amount,
    narration: `Loan written off for loan ${loanId}`,
  });
}

export async function getLoanLedger(loanId: string) {
  return getJournalEntriesForLoan(loanId);
}