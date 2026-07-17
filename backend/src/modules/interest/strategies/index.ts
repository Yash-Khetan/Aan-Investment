import { InterestStrategy, InterestBasis } from "../interest.types";
import { actual365Strategy } from "./actual365.strategy";
import { actual360Strategy } from "./actual360.strategy";
import { thirty360Strategy } from "./thirty360.strategy";
import { monthlyStrategy } from "./monthly.strategy";
import { fixedMonthlyStrategy } from "./fixedMonthly.strategy";
import { fullMonthStrategy } from "./fullMonth.strategy";
import { customStrategy } from "./custom.strategy";

export const interestStrategyRegistry: Record<InterestBasis, InterestStrategy> = {
  ACTUAL_365: actual365Strategy,
  ACTUAL_360: actual360Strategy,
  THIRTY_360: thirty360Strategy,
  MONTHLY: monthlyStrategy,
  FIXED_MONTHLY: fixedMonthlyStrategy,
  FULL_MONTH: fullMonthStrategy,
  CUSTOM: customStrategy,
};