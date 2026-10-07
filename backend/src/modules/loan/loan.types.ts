import type { z } from "zod";

import type { loans } from "../../db/schema";
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

/** Validated (coerced) API inputs. */
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;

/**
 * Loan row as every read returns it: with the borrower's display name, and
 * the interest and TDS rate of its current interest configuration.
 */
export type LoanWithBorrower = Loan & {
    borrowerName: string | null;
    interestRate: string;
    tdsRatePercent: string;
};

/** The loan-level figures every list and detail view shows, all from the loan's ledger snapshot. */
export interface LoanOverdueMetrics {
    amountOverdue: number;
    dpd: number;
    classification: LoanClassification;
    nextDueDate: string | null;
}

/** Loan row enriched with its ledger-derived figures; `snapshot` carries the full set. */
export type LoanWithMetrics = LoanWithBorrower &
    LoanOverdueMetrics & {
        balanceBifurcation: BalanceBifurcation | null;
        snapshot: LoanSnapshot;
    };
