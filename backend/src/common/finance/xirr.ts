/** A single dated cash flow: negative = money out, positive = money in. */
export interface CashFlow {
    date: Date;
    amount: number;
}

const MS_PER_YEAR = 365 * 86_400_000;

const yearsBetween = (from: Date, to: Date): number =>
    (to.getTime() - from.getTime()) / MS_PER_YEAR;

const npv = (rate: number, flows: CashFlow[], t0: Date): number =>
    flows.reduce(
        (sum, cf) => sum + cf.amount / (1 + rate) ** yearsBetween(t0, cf.date),
        0,
    );

const npvDerivative = (rate: number, flows: CashFlow[], t0: Date): number =>
    flows.reduce((sum, cf) => {
        const t = yearsBetween(t0, cf.date);
        if (t === 0) return sum;
        return sum - (t * cf.amount) / (1 + rate) ** (t + 1);
    }, 0);

/**
 * XIRR — the annualized discount rate that zeroes the NPV of irregularly
 * dated cash flows. Newton-Raphson first, bisection fallback if it doesn't
 * converge. Returns null for degenerate input (fewer than 2 flows, or flows
 * that are all the same sign — no rate can balance them).
 */
export function xirr(flows: CashFlow[], guess = 0.1): number | null {
    if (flows.length < 2) return null;
    const hasPositive = flows.some((f) => f.amount > 0);
    const hasNegative = flows.some((f) => f.amount < 0);
    if (!hasPositive || !hasNegative) return null;

    const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const t0 = sorted[0]!.date;

    let rate = guess;
    for (let i = 0; i < 100; i++) {
        const f = npv(rate, sorted, t0);
        const fPrime = npvDerivative(rate, sorted, t0);
        if (Math.abs(fPrime) < 1e-10) break;
        const nextRate = rate - f / fPrime;
        if (!Number.isFinite(nextRate) || nextRate <= -1) break;
        if (Math.abs(nextRate - rate) < 1e-7) return nextRate;
        rate = nextRate;
    }

    // Bisection fallback over a wide bracket.
    let lo = -0.9999;
    let hi = 10;
    let fLo = npv(lo, sorted, t0);
    const fHi = npv(hi, sorted, t0);
    if (Math.sign(fLo) === Math.sign(fHi)) return null;

    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const fMid = npv(mid, sorted, t0);
        if (Math.abs(fMid) < 1e-6) return mid;
        if (Math.sign(fMid) === Math.sign(fLo)) {
            lo = mid;
            fLo = fMid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

/**
 * XMIRR — modified IRR generalized to irregular dates: outflows are
 * discounted to the first cash-flow date at `financeRate` (the cost of the
 * capital being lent), inflows are compounded to the last cash-flow date at
 * `reinvestRate`, then a single rate is solved for over the span between
 * them. Returns null for degenerate input (no outflows/inflows, or a
 * zero-length span).
 */
export function xmirr(
    flows: CashFlow[],
    financeRate: number,
    reinvestRate: number,
): number | null {
    if (flows.length < 2) return null;
    const negatives = flows.filter((f) => f.amount < 0);
    const positives = flows.filter((f) => f.amount > 0);
    if (negatives.length === 0 || positives.length === 0) return null;

    const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const t0 = sorted[0]!.date;
    const tn = sorted[sorted.length - 1]!.date;
    const n = yearsBetween(t0, tn);
    if (n <= 0) return null;

    const pvNegatives = negatives.reduce(
        (sum, cf) => sum + cf.amount / (1 + financeRate) ** yearsBetween(t0, cf.date),
        0,
    );
    const fvPositives = positives.reduce(
        (sum, cf) => sum + cf.amount * (1 + reinvestRate) ** yearsBetween(cf.date, tn),
        0,
    );

    if (pvNegatives === 0) return null;
    return (fvPositives / -pvNegatives) ** (1 / n) - 1;
}
