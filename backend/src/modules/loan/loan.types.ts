import type { z } from "zod";

import type { loans } from "../../db/schema";
import type {
    createLoanSchema,
    updateLoanSchema,
    listLoansQuerySchema,
} from "./loan.validators";

/** Row as stored/returned by the database. */
export type Loan = typeof loans.$inferSelect;

/** Shape accepted by Drizzle's insert. */
export type NewLoan = typeof loans.$inferInsert;

/** Validated (coerced) API inputs. */
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;

/** Loan row enriched with the borrower's display name for list/detail views. */
export type LoanWithBorrower = Loan & { borrowerName: string | null };
