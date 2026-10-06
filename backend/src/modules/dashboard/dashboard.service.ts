import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";

import { db } from "../../db/index.js";
import { borrowers, ledgerEntries, loans } from "../../db/schema/index.js";
import { xirr, xmirr } from "../../common/finance/xirr.js";
import { getPortfolioCashFlows } from "../loan/loan.irr.js";
import type { LoanClassification } from "../ledger/dpd.js";
import { getLoanSnapshots, todayIso } from "../ledger/snapshot.service.js";
import { getCurrentRates } from "../interest/interest.repository.js";

function toNumber(value: string | null): number {
    return value === null ? 0 : Number(value);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

const CLASSIFICATIONS: LoanClassification[] = ["STD", "SMA-0", "SMA-1", "SMA-2", "NPA"];

/**
 * Portfolio totals and the delinquency split, every money figure summed from
 * each loan's ledger snapshot — the same figures the Loans list shows per
 * loan, so the dashboard always adds up to the list.
 */
export async function getPortfolioSummary() {
    const loanRows = await db
        .select({ id: loans.id, sanctionedAmount: loans.sanctionedAmount })
        .from(loans)
        .where(isNull(loans.deletedAt));

    const snapshots = await getLoanSnapshots(loanRows.map((l) => l.id));

    const byClassification = new Map(
        CLASSIFICATIONS.map((c) => [
            c,
            { classification: c, loanCount: 0, principalOutstanding: 0, amountOverdue: 0 },
        ]),
    );

    const totals = {
        totalLoans: loanRows.length,
        totalSanctioned: 0,
        totalDisbursed: 0,
        totalReceived: 0,
        totalOutstanding: 0,
        totalInterestDue: 0,
        totalPayable: 0,
        totalOverdue: 0,
        loansOverdue: 0,
    };

    for (const loan of loanRows) {
        const s = snapshots.get(loan.id)!;
        totals.totalSanctioned += toNumber(loan.sanctionedAmount);
        totals.totalDisbursed += s.totalDisbursed;
        totals.totalReceived += s.totalReceived;
        totals.totalOutstanding += s.principalOutstanding;
        totals.totalInterestDue += s.interestOutstanding;
        totals.totalPayable += s.totalPayable;
        totals.totalOverdue += s.amountOverdue;
        if (s.dpd > 0) totals.loansOverdue += 1;

        const bucket = byClassification.get(s.classification)!;
        bucket.loanCount += 1;
        bucket.principalOutstanding += s.principalOutstanding;
        bucket.amountOverdue += s.amountOverdue;
    }

    return {
        totals: {
            ...totals,
            totalSanctioned: round2(totals.totalSanctioned),
            totalDisbursed: round2(totals.totalDisbursed),
            totalReceived: round2(totals.totalReceived),
            totalOutstanding: round2(totals.totalOutstanding),
            totalInterestDue: round2(totals.totalInterestDue),
            totalPayable: round2(totals.totalPayable),
            totalOverdue: round2(totals.totalOverdue),
        },
        byClassification: [...byClassification.values()].map((b) => ({
            ...b,
            principalOutstanding: round2(b.principalOutstanding),
            amountOverdue: round2(b.amountOverdue),
        })),
    };
}

/**
 * Portfolio-wide money-weighted return. IRR is solved from the combined
 * ledger cash flows of every non-deleted loan (see `loan.irr.ts`). MIRR needs
 * a finance/reinvestment rate; per product decision, that's the portfolio's
 * disbursement-weighted-average interest rate applied uniformly, standing in
 * for "each loan's own rate" at the aggregate level. The weights are each
 * loan's ledger disbursements.
 */
export async function getOverallReturns() {
    const loanRows = await db
        .select({ id: loans.id })
        .from(loans)
        .where(isNull(loans.deletedAt));

    if (loanRows.length === 0) {
        return { overallIrr: null, overallMirr: null };
    }

    const loanIds = loanRows.map((l) => l.id);
    const [cashFlows, snapshots, rates] = await Promise.all([
        getPortfolioCashFlows(loanIds),
        getLoanSnapshots(loanIds),
        getCurrentRates(loanIds),
    ]);

    let weightedRateSum = 0;
    let totalDisbursed = 0;
    for (const loan of loanRows) {
        const disbursed = snapshots.get(loan.id)!.totalDisbursed;
        weightedRateSum += disbursed * (Number(rates.get(loan.id)?.interestRate ?? 0) / 100);
        totalDisbursed += disbursed;
    }
    const blendedRate = totalDisbursed > 0 ? weightedRateSum / totalDisbursed : 0;

    return {
        overallIrr: xirr(cashFlows),
        overallMirr: xmirr(cashFlows, blendedRate, blendedRate),
    };
}

/** Adds whole days to a YYYY-MM-DD date. */
function addDays(isoDate: string, days: number): string {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * Scheduled money movements: every Payment (disbursement) and Receipt dated
 * after today on a live loan. None of them counts in any other dashboard
 * figure until its date arrives — this is the one place they are shown,
 * listed soonest first with totals for the next 7 and 30 days and overall.
 */
export async function getScheduledSummary() {
    const today = todayIso();

    const rows = await db
        .select({
            id: ledgerEntries.id,
            entryDate: ledgerEntries.entryDate,
            vchType: ledgerEntries.vchType,
            debit: ledgerEntries.debit,
            credit: ledgerEntries.credit,
            narration: ledgerEntries.narration,
            loanId: loans.id,
            loanAccountNumber: loans.loanAccountNumber,
            borrowerName: borrowers.name,
        })
        .from(ledgerEntries)
        .innerJoin(loans, and(eq(ledgerEntries.loanId, loans.id), isNull(loans.deletedAt)))
        .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .where(and(gt(ledgerEntries.entryDate, today), inArray(ledgerEntries.vchType, ["PAYMENT", "RECEIPT"])))
        .orderBy(asc(ledgerEntries.entryDate), asc(ledgerEntries.sequenceNo));

    const entries = rows.map((r) => ({
        id: r.id,
        entryDate: r.entryDate,
        type: r.vchType === "PAYMENT" ? ("DISBURSEMENT" as const) : ("RECEIPT" as const),
        amount: Number(r.vchType === "PAYMENT" ? r.debit : r.credit),
        narration: r.narration,
        loanId: r.loanId,
        loanAccountNumber: r.loanAccountNumber,
        borrowerName: r.borrowerName,
    }));

    const window = (lastDate: string | null) => {
        const inWindow = entries.filter((e) => lastDate === null || e.entryDate <= lastDate);
        const sum = (type: "DISBURSEMENT" | "RECEIPT") =>
            round2(inWindow.filter((e) => e.type === type).reduce((acc, e) => acc + e.amount, 0));
        return { count: inWindow.length, disbursements: sum("DISBURSEMENT"), receipts: sum("RECEIPT") };
    };

    return {
        next7Days: window(addDays(today, 7)),
        next30Days: window(addDays(today, 30)),
        all: window(null),
        entries,
    };
}
