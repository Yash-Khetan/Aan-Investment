import type { z } from "zod";

import type { loans, loanTranches } from "../../db/schema";
import type { createDisbursementSchema } from "./disbursement.validators";

/** Row as stored/returned by the database. */
export type LoanTranche = typeof loanTranches.$inferSelect;

/** Shape accepted by Drizzle's insert. */
export type NewLoanTranche = typeof loanTranches.$inferInsert;

/** Loan row shape needed to derive/patch disbursement totals. */
export type Loan = typeof loans.$inferSelect;

/** Validated (coerced) API input. */
export type CreateDisbursementInput = z.infer<typeof createDisbursementSchema>;
