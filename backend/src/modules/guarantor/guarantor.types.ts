import type { z } from "zod";

import type { guarantors } from "../../db/schema";
import type {
    createGuarantorSchema,
    updateGuarantorSchema,
} from "./guarantor.validators";

/** Row as stored/returned by the database. */
export type Guarantor = typeof guarantors.$inferSelect;

/** Shape accepted by Drizzle's insert. */
export type NewGuarantor = typeof guarantors.$inferInsert;

/** Validated (coerced) API inputs. */
export type CreateGuarantorInput = z.infer<typeof createGuarantorSchema>;
export type UpdateGuarantorInput = z.infer<typeof updateGuarantorSchema>;
