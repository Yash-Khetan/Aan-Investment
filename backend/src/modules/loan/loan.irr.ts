import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/index";
import { loanTranches, loans, payments } from "../../db/schema";
import { xirr, type CashFlow } from "../../common/finance/xirr";
import { getOutstandingPrincipal } from "./loan.metrics";

/**
 * Builds each loan's realized cash-flow series: disbursement tranches as
 * outflows, SUCCESS payments as inflows, plus the loan's current outstanding
 * principal as a final notional inflow "as if collected today" — without
 * this, an active loan's IRR would be meaningless (deeply negative) simply
 * because most of its principal hasn't been repaid yet. This is the standard
 * "IRR to date" convention for an open lending book.
 *
 * Loans with no tranche rows (e.g. disbursed before tranche-tracking existed,
 * or an edge case where the increase-tracking write never fired) fall back to
 * a single synthetic outflow built from the loan's own disbursedAmount +
 * firstDisbursementDate, so a missing tranche history doesn't just silently
 * zero out the whole calculation.
 */
async function buildCashFlows(
    loanIds: string[],
): Promise<Map<string, CashFlow[]>> {
    const map = new Map<string, CashFlow[]>();
    if (loanIds.length === 0) return map;

    const [tranches, loanPayments, loanRows, outstandingByLoan] = await Promise.all([
        db
            .select({
                loanId: loanTranches.loanId,
                amount: loanTranches.amount,
                disbursementDate: loanTranches.disbursementDate,
            })
            .from(loanTranches)
            .where(inArray(loanTranches.loanId, loanIds)),
        db
            .select({
                loanId: payments.loanId,
                amount: payments.amount,
                paymentDate: payments.paymentDate,
            })
            .from(payments)
            .where(
                and(inArray(payments.loanId, loanIds), eq(payments.status, "SUCCESS")),
            ),
        db
            .select({
                id: loans.id,
                disbursedAmount: loans.disbursedAmount,
                firstDisbursementDate: loans.firstDisbursementDate,
                sanctionDate: loans.sanctionDate,
                createdAt: loans.createdAt,
            })
            .from(loans)
            .where(inArray(loans.id, loanIds)),
        // Computed, not the raw column — nothing updates loans.outstandingPrincipal
        // when a payment is recorded, so it drifts stale (see loan.metrics.ts).
        getOutstandingPrincipal(loanIds),
    ]);

    for (const id of loanIds) map.set(id, []);

    const today = new Date();
    const trancheLoanIds = new Set(tranches.map((t) => t.loanId));

    for (const t of tranches) {
        if (!t.disbursementDate) continue;
        map.get(t.loanId)?.push({
            date: new Date(`${t.disbursementDate}T00:00:00Z`),
            amount: -Number(t.amount),
        });
    }

    for (const loan of loanRows) {
        if (trancheLoanIds.has(loan.id)) continue;
        const disbursed = Number(loan.disbursedAmount ?? 0);
        if (disbursed <= 0) continue;
        const disbursementDate =
            loan.firstDisbursementDate ?? loan.sanctionDate ?? loan.createdAt;
        if (!disbursementDate) continue;
        map.get(loan.id)?.push({
            date: new Date(disbursementDate),
            amount: -disbursed,
        });
    }

    for (const p of loanPayments) {
        map.get(p.loanId)?.push({
            date: new Date(`${p.paymentDate}T00:00:00Z`),
            amount: Number(p.amount),
        });
    }

    for (const loan of loanRows) {
        const outstanding = outstandingByLoan.get(loan.id) ?? 0;
        if (outstanding > 0) {
            map.get(loan.id)?.push({ date: today, amount: outstanding });
        }
    }

    return map;
}

/** Per-loan IRR (annualized), keyed by loan id. Absent/null when the loan has no usable cash-flow series yet. */
export async function getLoanIrrs(
    loanIds: string[],
): Promise<Map<string, number | null>> {
    const flows = await buildCashFlows(loanIds);
    const result = new Map<string, number | null>();
    for (const [loanId, cashFlows] of flows) {
        result.set(loanId, xirr(cashFlows));
    }
    return result;
}

/** All loans' cash flows flattened into one series, for portfolio-wide IRR/MIRR. */
export async function getPortfolioCashFlows(
    loanIds: string[],
): Promise<CashFlow[]> {
    const flows = await buildCashFlows(loanIds);
    return [...flows.values()].flat();
}
