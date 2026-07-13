export interface AccountPair {
  debitAccount: string;
  creditAccount: string;
}

/**
 * Account name mapping, kept consistent with Dev C's accounting-export
 * module (src/modules/accounting-export/constants/account-mapping.constants.ts).
 * His module is the single source of truth for account NAMES since no
 * chart-of-accounts table exists in the schema yet — this mirrors his
 * naming exactly so journal entries created here match his Tally export.
 *
 * INTEREST_ACCRUAL is the one entry type his mapping doesn't cover (his
 * module only handles cash-received/paid events, not non-cash accrual).
 * Added here provisionally — flag to Dev C if his export ever needs to
 * include accrual entries too.
 */
export const ACCOUNTING_ACCOUNT_MAP: Record<string, AccountPair> = {
  DISBURSEMENT: {
    debitAccount: "Loan Principal Receivable",
    creditAccount: "Bank / Cash Account",
  },
  INTEREST_ACCRUAL: {
    debitAccount: "Interest Receivable",
    creditAccount: "Interest Income",
  },
  INTEREST_RECEIPT: {
    debitAccount: "Bank / Cash Account",
    creditAccount: "Interest Income",
  },
  PRINCIPAL_RECEIPT: {
    debitAccount: "Bank / Cash Account",
    creditAccount: "Loan Principal Receivable",
  },
  PENAL_INTEREST: {
    debitAccount: "Bank / Cash Account",
    creditAccount: "Penal Interest Income",
  },
  WRITE_OFF: {
    debitAccount: "Bad Debts Written Off",
    creditAccount: "Loan Principal Receivable",
  },
};

export const ACCOUNTING_ACCOUNT_CODES: Record<string, string> = {
  "Bank / Cash Account": "1000",
  "Loan Principal Receivable": "1100",
  "Interest Receivable": "1200",
  "Interest Income": "4000",
  "Penal Interest Income": "4100",
  "Bad Debts Written Off": "5000",
};