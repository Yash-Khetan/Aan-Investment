import { xirr, type CashFlow } from "../../common/finance/xirr";
import { ledgerCashFlows } from "../ledger/cashFlows";
import { getSyncedLedgers, todayIso } from "../ledger/snapshot.service";


async function buildCashFlows(loanIds: string[]): Promise<Map<string, CashFlow[]>> {
    const asOf = todayIso();
    const result = new Map<string, CashFlow[]>();
    for (const [loanId, entries] of await getSyncedLedgers(loanIds)) {
        result.set(loanId, ledgerCashFlows(entries, asOf));
    }
    return result;
}

/** Per-loan IRR (annualized), keyed by loan id. Null when the loan has no usable cash-flow series yet. */
export async function getLoanIrrs(loanIds: string[]): Promise<Map<string, number | null>> {
    const flows = await buildCashFlows(loanIds);
    const result = new Map<string, number | null>();
    for (const [loanId, cashFlows] of flows) {
        result.set(loanId, xirr(cashFlows));
    }
    return result;
}

/** All loans' cash flows flattened into one series, for portfolio-wide IRR/MIRR. */
export async function getPortfolioCashFlows(loanIds: string[]): Promise<CashFlow[]> {
    const flows = await buildCashFlows(loanIds);
    return [...flows.values()].flat();
}
