import { RepaymentStrategy, RepaymentType } from "../repayment.types";
import { emiStrategy } from "./emi.strategy";
import { bulletStrategy } from "./bullet.strategy";
import { interestOnlyStrategy } from "./interestOnly.strategy";
import { structuredStrategy } from "./structured.strategy";

export const repaymentStrategyRegistry: Record<RepaymentType, RepaymentStrategy> = {
  EMI: emiStrategy,
  BULLET: bulletStrategy,
  INTEREST_ONLY: interestOnlyStrategy,
  STRUCTURED: structuredStrategy,
  CUSTOM: structuredStrategy,
};