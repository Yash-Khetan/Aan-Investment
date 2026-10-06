/** Day-count bases the ledger's running-balance walk supports. Mirrors the `interest_basis` enum. */
export type InterestBasis = "ACTUAL_365" | "ACTUAL_360" | "MONTHLY_RATE_ACTUAL_30" | "FIXED_MONTHLY";

/** A single balance-changing event on a loan's timeline, used by the Running Balance Method. */
export interface PrincipalLedgerEvent {
  date: Date;
  /** Positive when the balance rises, negative when it falls. */
  delta: number;
}
