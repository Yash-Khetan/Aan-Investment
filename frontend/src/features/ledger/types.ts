export type LedgerVchType = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

export interface LedgerEntry {
  id: string;
  loanId: string;
  entryDate: string;
  narration: string | null;
  vchType: LedgerVchType;
  vchNo: string;
  debit: string | null;
  credit: string | null;
  pairedEntryId: string | null;
  accrualMonth: string | null;
  ratePercent: string | null;
  isSystemGenerated: boolean;
  /** Day-count basis this entry was accrued under. Null on rows posted before it was snapshotted. */
  interestBasis: string | null;
  includeOpeningClosingDays: boolean | null;
  /** MANUAL: recorded on the Ledger tab. SYSTEM: the ledger's own month-end interest/TDS. IMPORT: from an imported sheet. */
  source: "MANUAL" | "SYSTEM" | "IMPORT";
  /** The voucher type and number the imported sheet printed. Null unless imported. */
  sourceVchType: string | null;
  sourceVchNo: string | null;
  /** When the entry was locked, and null while it is not. Every imported entry is locked as it is posted. */
  lockedAt: string | null;
  /** Imported from a ledger sheet, so read-only for good. Only removing the whole import takes it out. */
  isLocked: boolean;
  /**
   * May be edited or removed: a Payment or Receipt recorded by hand. Decided
   * server-side (modules/ledger/entryRules.ts) and sent with the row, so the
   * Edit button and the API can never disagree about it.
   */
  isEditable: boolean;
  /** Why the entry cannot be changed, to show the user. Null when it can. */
  lockReason: string | null;
  /** Dated after today: shown, but counted in no figure until its date arrives. */
  isScheduled: boolean;
  /** Computed cumulative running balance, attached server-side — never independently stored. */
  balance: number;
  /** What `balance` is made of right after this entry: principal plus each month's unpaid net interest. */
  bifurcation: BalanceBifurcation;
  /** On a Receipt, how it was appropriated — interest oldest month first, then principal. Null on every other row. */
  allocation: ReceiptAllocation | null;
}

/**
 * A ledger balance split into principal and each accrual month's interest
 * (net of TDS) still unpaid. The parts always add up to the balance.
 */
export interface BalanceBifurcation {
  /** Negative only when receipts have paid back more than was lent. */
  principal: number;
  /** Oldest first; fully-paid months are left out. `month` is the first of the accrual month, YYYY-MM-DD. */
  interest: Array<{ month: string; amount: number }>;
}

export interface ReceiptAllocation {
  /** `cleared` is true when this receipt finished paying off the month. */
  interest: Array<{ month: string; amount: number; cleared: boolean }>;
  principal: number;
}

/**
 * The interest configuration this ledger is accruing at, read from the Loan
 * module. Display only — there is no write path back from the Ledger.
 */
export interface LedgerSettings {
  loanId: string;
  /** The rates and day-count actually in effect today, from the current interest configuration. */
  currentInterestRatePercent: string;
  currentTdsRatePercent: string;
  interestBasis: string;
  includeOpeningClosingDays: boolean;
}

export interface LoanLedger {
  entries: LedgerEntry[];
  settings: LedgerSettings;
}

export interface CreateEntryInput {
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}

/**
 * An edit to a hand-recorded Payment or Receipt. Only these four fields may
 * change; everything else on an entry is derived or system-managed, and the
 * backend accepts no other key. Send only what changed.
 */
export interface UpdateEntryInput {
  entryDate?: string;
  vchType?: "PAYMENT" | "RECEIPT";
  amount?: number;
  /** Empty or null clears the narration. */
  narration?: string | null;
}

/* ------------------------------------------------------------------ */
/* DPD history                                                         */
/*                                                                     */
/* Month-by-month Days Past Due for one loan. A null month is "X" -    */
/* outside the loan's life, which is not the same as a month with      */
/* nothing overdue (0).                                                */
/* ------------------------------------------------------------------ */

/** RBI asset classification, derived from DPD: STD 0, SMA-0 1-30, SMA-1 31-60, SMA-2 61-90, NPA 90+. */
export type DpdClassification = "STD" | "SMA-0" | "SMA-1" | "SMA-2" | "NPA";

export interface DpdMonth {
  /** Days past due as at this month's end (as at today, for the month in progress). Part-payments count proportionally. */
  dpd: number;
  classification: DpdClassification;
  /** Balance: net interest already past due by then and still not received, in rupees. */
  amountOverdue: number;
  /** The month still in progress - its figure is still moving. */
  isCurrentMonth: boolean;
}

export interface DpdYearRow {
  year: number;
  /** Twelve entries, Jan..Dec. Null renders as "X". */
  months: Array<DpdMonth | null>;
}

export interface DpdGrid {
  loanId: string;
  /** One row per year from the loan's first ledger entry to its maturity. Empty when the ledger is. */
  years: DpdYearRow[];
  current: {
    dpd: number;
    classification: DpdClassification;
    amountOverdue: number;
    oldestOverdueDueDate: string | null;
  } | null;
  worstDpd: number;
}

/* ------------------------------------------------------------------ */
/* Loan snapshot - every money figure about a loan as at one date,     */
/* read off its ledger. The backend computes it once (ledger/          */
/* snapshot.ts); every screen shows these figures, never its own.      */
/* ------------------------------------------------------------------ */

export interface LoanSnapshot {
  asOf: string;
  hasEntries: boolean;
  bifurcation: BalanceBifurcation;
  principalOutstanding: number;
  /** Interest posted (net of TDS) and not yet received. */
  interestOutstanding: number;
  /** Principal plus unpaid interest - always equals the ledger balance. */
  totalPayable: number;
  closingBalance: number;
  amountOverdue: number;
  dpd: number;
  classification: DpdClassification;
  oldestOverdueDueDate: string | null;
  nextDueDate: string | null;
  totalDisbursed: number;
  totalReceived: number;
  totalInterest: number;
  totalTds: number;
  firstDisbursementDate: string | null;
  lastReceiptDate: string | null;
}

/* ------------------------------------------------------------------ */
/* Interest accrued till today                                         */
/*                                                                     */
/* Interest the loan has earned through the as-of date, posted and     */
/* not yet posted together. The ledger posts interest only at          */
/* month-end, so on any other day part of what has been earned has no  */
/* Journal row yet; the backend walks it with the same interest engine */
/* a real posting uses (modules/ledger/accrual.ts) and sends the       */
/* figure here. Nothing is recalculated in the browser.                */
/*                                                                     */
/* Three different figures, never to be read as one:                   */
/*   accrued - earned through today, posted or not.                    */
/*   due     - posted, net of TDS, and still unpaid.                   */
/*   overdue - due, and already past its due date.                     */
/* ------------------------------------------------------------------ */

/** One month with no interest journal yet, as the backend accrued it. */
export interface UnpostedAccrualMonth {
  /** First of the accrual month, YYYY-MM-DD. */
  month: string;
  /** Where the accrual stops: the month's end, or the as-of date for the month in progress. */
  accruedThrough: string;
  interestAmount: number;
  tdsAmount: number;
  interestRatePercent: number;
  interestBasis: string;
  includeOpeningClosingDays: boolean;
  /** False for the month in progress, whose figure is still moving. */
  isComplete: boolean;
}

export interface InterestAccrual {
  asOf: string;
  /** First day of the earliest month the loan accrues for. Null while there is nothing to accrue on. */
  accrualStartDate: string | null;
  /** Interest earned through `asOf`, gross of TDS. */
  interestAccruedTillToday: number;
  /** The part of it carried by posted Journal Interest rows. */
  postedInterest: number;
  /** The part accrued since the last posted month, with no journal yet. */
  unpostedInterest: number;
  unpostedTds: number;
  /** First day of the unposted stretch. Null when nothing is accruing beyond what is posted. */
  unpostedFrom: string | null;
  unpostedMonths: UnpostedAccrualMonth[];
  /** Entry date of the latest interest journal posted on or before `asOf`. */
  lastPostedAccrualDate: string | null;
  lastPostedAccrualMonth: string | null;
  /** TDS deducted at source on accrued interest. */
  tdsAdjusted: number;
  /** Interest settled by receipts, as the appropriation waterfall allocated them. */
  interestPaid: number;
  /** Posted interest, net of TDS, still unpaid — the snapshot's `interestOutstanding`. */
  interestDue: number;
  /** Of `interestDue`, the part already past its due date. */
  interestOverdue: number;
  /** The rate and day-count the accrual ran at. Null when the loan has never accrued and is not accruing. */
  interestRatePercent: number | null;
  interestBasis: string | null;
  includeOpeningClosingDays: boolean | null;
}
