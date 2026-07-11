import {
    pgTable,
    uuid,
    varchar,
    integer,
    boolean,
    text,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    waterfallBucketTypeEnum,
    timestamps,
} from "./shared";

import { loans, loanTranches } from "./loan";

/* ============================================================
   PAYMENT WATERFALL CONFIGS
============================================================ */

export const paymentWaterfallConfigs = pgTable("payment_waterfall_configs", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    name: varchar("name", {
        length: 100,
    }),

    isCurrent: boolean("is_current")
        .default(true),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    waterfallConfigLoanIdx: index("waterfall_config_loan_idx")
        .on(table.loanId),

    waterfallConfigCurrentIdx: index("waterfall_config_current_idx")
        .on(table.loanId, table.isCurrent),

}));

/* ============================================================
   PAYMENT WATERFALL STEPS (Ordered)
============================================================ */

export const paymentWaterfallSteps = pgTable("payment_waterfall_steps", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    waterfallConfigId: uuid("waterfall_config_id")
        .references(() => paymentWaterfallConfigs.id, {
            onDelete: "cascade",
        })
        .notNull(),

    stepOrder: integer("step_order")
        .notNull(),

    bucketType: waterfallBucketTypeEnum("bucket_type")
        .notNull(),

    /* Only populated when bucketType = SPECIFIC_TRANCHE */
    trancheId: uuid("tranche_id")
        .references(() => loanTranches.id),

    ...timestamps,

}, (table) => ({

    waterfallStepConfigIdx: index("waterfall_step_config_idx")
        .on(table.waterfallConfigId),

    waterfallStepOrderIdx: uniqueIndex("waterfall_step_order_idx")
        .on(table.waterfallConfigId, table.stepOrder),

}));