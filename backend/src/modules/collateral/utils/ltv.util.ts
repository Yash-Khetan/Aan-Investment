import { LtvCalculationError } from "./errors";
import { LTV_DECIMAL_PLACES } from "../constants/collateral.constants";

/**
 * LTV = Loan Outstanding / Market Value * 100, rounded to LTV_DECIMAL_PLACES.
 * Throws LtvCalculationError when the market value is missing, zero, or negative —
 * dividing by such a value would produce a meaningless or infinite ratio.
 */
export function calculateLtv(loanOutstanding: number | string, marketValue: number | string): number {
    const outstanding = Number(loanOutstanding);
    const value = Number(marketValue);

    if (!Number.isFinite(outstanding) || outstanding < 0) {
        throw new LtvCalculationError(`Invalid loan outstanding amount "${loanOutstanding}".`);
    }

    if (!Number.isFinite(value) || value <= 0) {
        throw new LtvCalculationError(`Cannot calculate LTV against a market value of "${marketValue}".`);
    }

    const ltv = (outstanding / value) * 100;
    const factor = 10 ** LTV_DECIMAL_PLACES;

    return Math.round(ltv * factor) / factor;
}
