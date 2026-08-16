import { InterestStrategy, InterestBasis } from "../interest.types";
import { actual365Strategy } from "./actual365.strategy";
import { actual360Strategy } from "./actual360.strategy";
import { thirty360Strategy } from "./thirty360.strategy";
import { monthlyStrategy } from "./monthly.strategy";
import { fixedMonthlyStrategy } from "./fixedMonthly.strategy";
import { fullMonthStrategy } from "./fullMonth.strategy";
import { customStrategy } from "./custom.strategy";
import { monthlyRateActual30Strategy } from "./monthlyRateActual30.strategy";

// THIRTY_360 and MONTHLY stay registered so existing interest_configs rows
// created before these were retired from selection keep calculating exactly
// as they always did — they're just no longer offered in the frontend
// dropdown or the create-config validator for new configs.
export const interestStrategyRegistry: Record<InterestBasis, InterestStrategy> = {
  ACTUAL_365: actual365Strategy,
  ACTUAL_360: actual360Strategy,
  THIRTY_360: thirty360Strategy,
  MONTHLY: monthlyStrategy,
  FIXED_MONTHLY: fixedMonthlyStrategy,
  FULL_MONTH: fullMonthStrategy,
  CUSTOM: customStrategy,
  MONTHLY_RATE_ACTUAL_30: monthlyRateActual30Strategy,
};