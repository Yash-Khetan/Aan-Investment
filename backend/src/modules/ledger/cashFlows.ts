import type { CashFlow } from "../../common/finance/xirr";
import type { LedgerEntryRow } from "./ledger.repository";
import { computeLoanSnapshot } from "./snapshot";

const asDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);

/**
 * One loan's realized cash flows, read off its ledger:
 *
 *   Payment (disbursement)   money out, on its date.
 *   Receipt                  money in, on its date.
 *   TDS journal              money in, on its date — tax the borrower
 *                            deducted at source on our behalf, which we
 *                            recover against it, so the ledger credits it
 *                            exactly like a receipt.
 *   Closing balance          a final notional inflow today, "as if
 *                            collected now" — principal plus unpaid
 *                            interest, the same figure the snapshot shows
 *                            as payable. Without it an open loan's IRR is
 *                            meaningless simply because it hasn't been
 *                            repaid yet: the standard IRR-to-date
 *                            convention for an open lending book.
 *
 * Interest journals are not cash and are not flows of their own: what they
 * add to the balance is collected through receipts, or sits in the closing
 * balance.
 */
export function ledgerCashFlows(entries: LedgerEntryRow[], asOf: string): CashFlow[] {
    const flows: CashFlow[] = [];

    for (const e of entries) {
        if (e.entryDate > asOf) continue;
        if (e.vchType === "PAYMENT" && e.debit) flows.push({ date: asDate(e.entryDate), amount: -Number(e.debit) });
        if (e.vchType === "RECEIPT" && e.credit) flows.push({ date: asDate(e.entryDate), amount: Number(e.credit) });
        if (e.vchType === "JOURNAL_TDS" && e.credit) flows.push({ date: asDate(e.entryDate), amount: Number(e.credit) });
    }

    const { closingBalance } = computeLoanSnapshot(entries, asOf);
    if (closingBalance !== 0) flows.push({ date: asDate(asOf), amount: closingBalance });

    return flows;
}
