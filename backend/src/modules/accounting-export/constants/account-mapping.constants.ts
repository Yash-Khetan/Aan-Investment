import type { TransactionType } from "../types/accounting-export.types.js";

/* ============================================================
   DEFAULT DOUBLE-ENTRY ACCOUNT MAPPING
   Standard chart-of-accounts labels used to populate the
   Debit Account / Credit Account columns of every export.
   No chart-of-accounts table exists in the schema yet, so this
   mapping is the single source of truth — update here if the
   ledger account names ever change.
============================================================ */

export const ACCOUNT_MAPPING: Record<
    TransactionType,
    { debitAccount: string; creditAccount: string }
> = {
    PRINCIPAL_RECEIVED: {
        debitAccount: "Bank / Cash Account",
        creditAccount: "Loan Principal Receivable",
    },
    INTEREST_RECEIVED: {
        debitAccount: "Bank / Cash Account",
        creditAccount: "Interest Income",
    },
    PENALTY_CHARGES: {
        debitAccount: "Bank / Cash Account",
        creditAccount: "Penal Interest Income",
    },
    LOAN_DISBURSEMENT: {
        debitAccount: "Loan Principal Receivable",
        creditAccount: "Bank / Cash Account",
    },
    LOAN_CLOSURE: {
        debitAccount: "Loan Principal Receivable",
        creditAccount: "Loan Closure Suspense Account",
    },
    LOAN_WRITE_OFF: {
        debitAccount: "Bad Debts Written Off",
        creditAccount: "Loan Principal Receivable",
    },
    REFUND: {
        debitAccount: "Customer Refunds Payable",
        creditAccount: "Bank / Cash Account",
    },
};
