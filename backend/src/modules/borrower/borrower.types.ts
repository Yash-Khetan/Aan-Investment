import type { z } from "zod";

import type { borrowers, promoters, guarantors } from "../../db/schema";
import type {
    createBorrowerSchema,
    updateBorrowerSchema,
    listBorrowersQuerySchema,
} from "./borrower.validators";

/** Rows as stored/returned by the database. */
export type Borrower = typeof borrowers.$inferSelect;
export type Promoter = typeof promoters.$inferSelect;
export type Guarantor = typeof guarantors.$inferSelect;

/** Shapes accepted by Drizzle inserts. */
export type NewBorrower = typeof borrowers.$inferInsert;
export type NewPromoter = typeof promoters.$inferInsert;
export type NewGuarantor = typeof guarantors.$inferInsert;

/** Validated (coerced) API inputs. */
export type CreateBorrowerInput = z.infer<typeof createBorrowerSchema>;
export type UpdateBorrowerInput = z.infer<typeof updateBorrowerSchema>;
export type ListBorrowersQuery = z.infer<typeof listBorrowersQuerySchema>;

/** Borrower enriched with relationship-manager name for list/detail views. */
export type BorrowerWithManager = Borrower & {
    relationshipManagerName: string | null;
};

/** Full borrower detail including its child entities. */
export type BorrowerDetail = BorrowerWithManager & {
    promoters: Promoter[];
    guarantors: Guarantor[];
};
