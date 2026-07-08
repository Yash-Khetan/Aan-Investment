import type { CollateralStatus } from "../types/collateral.types";

/** Status assigned to a collateral/insurance row when the caller doesn't specify one. */
export const DEFAULT_COLLATERAL_STATUS: CollateralStatus = "ACTIVE";

/** Decimal places kept when rounding a computed LTV percentage. */
export const LTV_DECIMAL_PLACES = 2;

/** Collateral types that are expected to carry a `surveyNumber` used for duplicate detection. */
export const SURVEY_NUMBER_TYPES = ["PROPERTY"] as const;
