import type { IdentityDocumentFields } from "./identity-document.service";
import type { z } from "zod";

import type { borrowers, promoters } from "../../db/schema";
import type {
    createBorrowerSchema,
    updateBorrowerSchema,
    listBorrowersQuerySchema,
    promoterSchema,
    updatePromoterSchema,
} from "./borrower.validators";

/** Rows as stored/returned by the database. */
export type Borrower = typeof borrowers.$inferSelect;
export type Promoter = typeof promoters.$inferSelect;

/** Shapes accepted by Drizzle inserts. */
export type NewBorrower = typeof borrowers.$inferInsert;
export type NewPromoter = typeof promoters.$inferInsert;

/** Validated (coerced) API inputs. */
export type CreateBorrowerInput = z.infer<typeof createBorrowerSchema>;
export type UpdateBorrowerInput = z.infer<typeof updateBorrowerSchema>;
export type ListBorrowersQuery = z.infer<typeof listBorrowersQuerySchema>;

/** Related-person ("promoter") API inputs. */
export type CreatePromoterInput = z.infer<typeof promoterSchema>;
export type UpdatePromoterInput = z.infer<typeof updatePromoterSchema>;

/** Borrower enriched with relationship-manager name for list/detail views. */
/** A borrower read: the row, its manager's name, and its current identity scans (from `documents`). */
export type BorrowerWithManager = Borrower &
    IdentityDocumentFields & {
        relationshipManagerName: string | null;
    };

/** Full borrower detail including its child entities. */
export type BorrowerDetail = BorrowerWithManager & {
    promoters: Promoter[];
};
