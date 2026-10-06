import type { z } from "zod";

import type { loans, loanTranches } from "../../db/schema";
import type {
    createLoanSchema,
    updateLoanSchema,
    listLoansQuerySchema,
} from "./loan.validators";
import type { BalanceBifurcation } from "../ledger/ledger.types";
import type { LoanClassification } from "../ledger/dpd";
import type { LoanSnapshot } from "../ledger/snapshot";

/** Row as stored/returned by the database. */
export type Loan = typeof loans.$inferSelect;

/** Shape accepted by Drizzle's insert. */
export type NewLoan = typeof loans.$inferInsert;

/** Shape accepted by Drizzle's insert for a disbursement tranche. */
export type NewLoanTranche = typeof loanTranches.$inferInsert;

/** Validated (coerced) API inputs. */
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;

/** Loan row enriched with the borrower's display name for list/detail views. */
export type LoanWithBorrower = Loan & { borrowerName: string | null };

/** The loan-level figures every list and detail view shows, all from the loan's ledger snapshot. */
export interface LoanOverdueMetrics {
    amountOverdue: number;
    dpd: number;
    classification: LoanClassification;
    nextDueDate: string | null;
}

/**
 * Loan row enriched with its ledger-derived figures. `outstandingPrincipal`
 * is overwritten with the ledger's principal; `snapshot` carries the full set.
 */
export type LoanWithMetrics = LoanWithBorrower &
    LoanOverdueMetrics & {
        balanceBifurcation: BalanceBifurcation | null;
        snapshot: LoanSnapshot;
    };
