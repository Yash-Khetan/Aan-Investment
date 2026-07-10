import { collectionStatusEnum } from "../../../db/schema";

/**
 * The `follow_ups.follow_up_type` column is a plain varchar(50) in the
 * schema (no Postgres enum backs it), so the set of allowed activity
 * kinds is enforced here at the module level instead. Values mirror the
 * business examples for collection activities.
 */
export const ACTIVITY_TYPES = [
    "CALL",
    "REMINDER_SENT",
    "BRANCH_VISIT",
    "PROMISE_TO_PAY_CREATED",
    "PROMISE_FULFILLED",
    "PROMISE_BROKEN",
    "RECOVERY_VISIT",
    "LEGAL_NOTICE",
    "SETTLEMENT_DISCUSSION",
    "OTHER",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Status assigned to a loan's collection case when the first activity is logged against it. */
export const DEFAULT_COLLECTION_STATUS: (typeof collectionStatusEnum.enumValues)[number] = "OPEN";

/** Matches the `follow_up_type` column width; enforced here since the column has no length check beyond Postgres truncation. */
export const ACTIVITY_TYPE_MAX_LENGTH = 50;
