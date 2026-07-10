/**
 * Comprehensive, idempotent demo-data seed covering every module in the app:
 * borrowers, loans (every status), interest configs, repayment schedules +
 * installments, payments + allocations, loan tranches (disbursements),
 * collateral + insurance, collection activities (incl. Promise to Pay),
 * and documents (real uploads to Supabase Storage via DocumentService).
 *
 * Safe to re-run: `clearSeedData()` removes everything tagged with the
 * `SEED-` marker (plus stray `__TEST_*` rows left behind by individual
 * modules' standalone dev servers) before `seedAll()` inserts fresh data.
 *
 *   npm run seed
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { inArray, like, or } from "drizzle-orm";

import { db } from "../index.js";
import {
    borrowers,
    loans,
    loanTranches,
    loanStatusHistory,
    interestConfigs,
    repaymentSchedules,
    installments,
    payments,
    paymentAllocations,
    collectionCases,
    documents,
} from "../schema/index.js";

import { CollateralService } from "../../modules/collateral/index.js";
import { CollectionsService } from "../../modules/collections/index.js";
import { DocumentService } from "../../modules/document-vault/index.js";

const SEED_MARKER = "SEED-";
const TEST_MARKER = "__TEST_";

/** A valid, tiny 1x1 PNG — used as placeholder file content for every seeded document. */
const PLACEHOLDER_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
);

function daysFromNow(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

/* ============================================================
   CLEANUP — deletes in FK-safe order, scoped to seed/test markers only.
============================================================ */

export async function clearSeedData(): Promise<void> {
    const markedBorrowers = await db
        .select({ id: borrowers.id })
        .from(borrowers)
        .where(or(like(borrowers.borrowerCode, `${SEED_MARKER}%`), like(borrowers.borrowerCode, `${TEST_MARKER}%`)));

    const markedLoans = await db
        .select({ id: loans.id })
        .from(loans)
        .where(or(like(loans.loanAccountNumber, `${SEED_MARKER}%`), like(loans.loanAccountNumber, `${TEST_MARKER}%`)));

    const borrowerIds = markedBorrowers.map((b) => b.id);
    const loanIds = markedLoans.map((l) => l.id);

    if (loanIds.length) {
        // No cascade on payments/collectionCases -> loans; must go first.
        await db.delete(payments).where(inArray(payments.loanId, loanIds));
        await db.delete(collectionCases).where(inArray(collectionCases.loanId, loanIds));
    }

    if (loanIds.length || borrowerIds.length) {
        // documents.ownerId has no FK constraint, so this is just tidy-up, not a requirement.
        await db.delete(documents).where(inArray(documents.ownerId, [...loanIds, ...borrowerIds]));
    }

    if (loanIds.length) {
        // Cascades: loanTranches, loanStatusHistory, repaymentSchedules -> installments,
        // interestConfigs, penalInterestRules, collaterals -> insurance/chargeRecords.
        await db.delete(loans).where(inArray(loans.id, loanIds));
    }

    if (borrowerIds.length) {
        await db.delete(borrowers).where(inArray(borrowers.id, borrowerIds));
    }

    console.log(
        `Cleared ${loanIds.length} loan(s) and ${borrowerIds.length} borrower(s) tagged as seed/test data.`,
    );
}

/* ============================================================
   BORROWERS
============================================================ */

async function seedBorrowers() {
    const rows = await db
        .insert(borrowers)
        .values([
            {
                borrowerCode: "SEED-BRW-001",
                name: "Rajesh Kumar Traders",
                constitution: "PROPRIETORSHIP",
                email: "rajesh.traders@example.com",
                phone: "9820011111",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                pan: "AAAPT1234A",
                internalRating: "A",
            },
            {
                borrowerCode: "SEED-BRW-002",
                name: "Priya Sharma",
                constitution: "INDIVIDUAL",
                email: "priya.sharma@example.com",
                phone: "9820022222",
                city: "Pune",
                state: "Maharashtra",
                pincode: "411001",
                pan: "BBBPS5678B",
                internalRating: "A",
            },
            {
                borrowerCode: "SEED-BRW-003",
                name: "Vikram Enterprises Pvt Ltd",
                constitution: "PRIVATE_LIMITED",
                email: "accounts@vikramenterprises.example.com",
                phone: "9820033333",
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001",
                pan: "CCCPV9012C",
                gst: "24CCCPV9012C1Z5",
                internalRating: "C",
                ratingRemarks: "Elevated risk — under active recovery monitoring.",
            },
            {
                borrowerCode: "SEED-BRW-004",
                name: "Sunita Devi",
                constitution: "INDIVIDUAL",
                email: "sunita.devi@example.com",
                phone: "9820044444",
                city: "Jaipur",
                state: "Rajasthan",
                pincode: "302001",
                pan: "DDDPS3456D",
                internalRating: "D",
            },
            {
                borrowerCode: "SEED-BRW-005",
                name: "Amit Patel",
                constitution: "INDIVIDUAL",
                email: "amit.patel@example.com",
                phone: "9820055555",
                city: "Surat",
                state: "Gujarat",
                pincode: "395001",
                pan: "EEEPA7890E",
                internalRating: "B",
            },
        ])
        .returning({ id: borrowers.id, name: borrowers.name });

    return {
        rajesh: rows[0]!.id,
        priya: rows[1]!.id,
        vikram: rows[2]!.id,
        sunita: rows[3]!.id,
        amit: rows[4]!.id,
    };
}

/* ============================================================
   LOANS
============================================================ */

async function seedLoans(borrowerIds: Awaited<ReturnType<typeof seedBorrowers>>) {
    const rows = await db
        .insert(loans)
        .values([
            {
                loanAccountNumber: "SEED-LN-ACTIVE-001",
                borrowerId: borrowerIds.rajesh,
                loanType: "SECURED",
                repaymentType: "EMI",
                sanctionedAmount: "1000000",
                disbursedAmount: "1000000",
                outstandingPrincipal: "800000",
                interestRate: "12.5",
                tenureMonths: 24,
                sanctionDate: daysFromNow(-190),
                firstDisbursementDate: daysFromNow(-180),
                status: "ACTIVE",
                purpose: "Working capital for trading business",
            },
            {
                loanAccountNumber: "SEED-LN-ACTIVE-002",
                borrowerId: borrowerIds.priya,
                loanType: "UNSECURED",
                repaymentType: "EMI",
                sanctionedAmount: "300000",
                disbursedAmount: "300000",
                outstandingPrincipal: "200000",
                interestRate: "13.5",
                tenureMonths: 18,
                sanctionDate: daysFromNow(-160),
                firstDisbursementDate: daysFromNow(-150),
                status: "ACTIVE",
                purpose: "Personal loan — home renovation",
            },
            {
                loanAccountNumber: "SEED-LN-OVERDUE-001",
                borrowerId: borrowerIds.rajesh,
                loanType: "UNSECURED",
                repaymentType: "EMI",
                sanctionedAmount: "500000",
                disbursedAmount: "500000",
                outstandingPrincipal: "420000",
                interestRate: "14",
                tenureMonths: 12,
                sanctionDate: daysFromNow(-100),
                firstDisbursementDate: daysFromNow(-90),
                status: "OVERDUE",
                purpose: "Inventory purchase",
            },
            {
                loanAccountNumber: "SEED-LN-NPA-001",
                borrowerId: borrowerIds.vikram,
                loanType: "SECURED",
                repaymentType: "BULLET",
                sanctionedAmount: "2000000",
                disbursedAmount: "2000000",
                outstandingPrincipal: "2000000",
                interestRate: "15",
                tenureMonths: 6,
                sanctionDate: daysFromNow(-210),
                firstDisbursementDate: daysFromNow(-200),
                status: "NPA",
                purpose: "Bridge financing",
                remarks: "Overdue beyond 90 days — classified NPA per policy.",
            },
            {
                loanAccountNumber: "SEED-LN-CLOSED-001",
                borrowerId: borrowerIds.vikram,
                loanType: "SECURED",
                repaymentType: "EMI",
                sanctionedAmount: "300000",
                disbursedAmount: "300000",
                outstandingPrincipal: "0",
                interestRate: "11",
                tenureMonths: 12,
                sanctionDate: daysFromNow(-380),
                firstDisbursementDate: daysFromNow(-370),
                maturityDate: daysFromNow(-10),
                status: "CLOSED",
                purpose: "Equipment purchase",
            },
            {
                loanAccountNumber: "SEED-LN-WRITTENOFF-001",
                borrowerId: borrowerIds.sunita,
                loanType: "UNSECURED",
                repaymentType: "EMI",
                sanctionedAmount: "250000",
                disbursedAmount: "250000",
                outstandingPrincipal: "250000",
                interestRate: "16",
                tenureMonths: 12,
                sanctionDate: daysFromNow(-300),
                firstDisbursementDate: daysFromNow(-290),
                status: "WRITTEN_OFF",
                purpose: "Personal loan",
                remarks: "Written off — recovery avenues exhausted.",
            },
            {
                loanAccountNumber: "SEED-LN-PENDING-001",
                borrowerId: borrowerIds.sunita,
                loanType: "UNSECURED",
                repaymentType: "EMI",
                sanctionedAmount: "150000",
                disbursedAmount: "0",
                outstandingPrincipal: "0",
                interestRate: "13",
                tenureMonths: 12,
                sanctionDate: daysFromNow(-5),
                status: "PENDING",
                purpose: "Medical expenses",
            },
            {
                loanAccountNumber: "SEED-LN-ACTIVE-003",
                borrowerId: borrowerIds.amit,
                loanType: "SECURED",
                repaymentType: "STRUCTURED",
                sanctionedAmount: "5000000",
                disbursedAmount: "3000000",
                outstandingPrincipal: "3000000",
                interestRate: "12",
                tenureMonths: 36,
                sanctionDate: daysFromNow(-310),
                firstDisbursementDate: daysFromNow(-300),
                status: "ACTIVE",
                purpose: "Commercial property construction — phased disbursement",
            },
        ])
        .returning({ id: loans.id, accountNumber: loans.loanAccountNumber });

    const byAccount = Object.fromEntries(rows.map((r) => [r.accountNumber, r.id]));

    return {
        active1: byAccount["SEED-LN-ACTIVE-001"]!,
        active2: byAccount["SEED-LN-ACTIVE-002"]!,
        overdue1: byAccount["SEED-LN-OVERDUE-001"]!,
        npa1: byAccount["SEED-LN-NPA-001"]!,
        closed1: byAccount["SEED-LN-CLOSED-001"]!,
        writtenOff1: byAccount["SEED-LN-WRITTENOFF-001"]!,
        pending1: byAccount["SEED-LN-PENDING-001"]!,
        active3: byAccount["SEED-LN-ACTIVE-003"]!,
    };
}

/* ============================================================
   INTEREST CONFIGS + TRANCHES (DISBURSEMENTS)
============================================================ */

async function seedInterestAndTranches(loanIds: Awaited<ReturnType<typeof seedLoans>>) {
    await db.insert(interestConfigs).values([
        { loanId: loanIds.active1, annualRate: "12.5", interestBasis: "ACTUAL_365", ruleType: "NORMAL", effectiveFrom: daysFromNow(-180) },
        { loanId: loanIds.active2, annualRate: "13.5", interestBasis: "ACTUAL_365", ruleType: "NORMAL", effectiveFrom: daysFromNow(-150) },
        { loanId: loanIds.overdue1, annualRate: "14", interestBasis: "ACTUAL_365", ruleType: "NORMAL", effectiveFrom: daysFromNow(-90) },
        { loanId: loanIds.npa1, annualRate: "15", interestBasis: "ACTUAL_365", ruleType: "NORMAL", effectiveFrom: daysFromNow(-200) },
        { loanId: loanIds.closed1, annualRate: "11", interestBasis: "ACTUAL_365", ruleType: "NORMAL", effectiveFrom: daysFromNow(-370) },
        { loanId: loanIds.active3, annualRate: "12", interestBasis: "ACTUAL_365", ruleType: "STEP_UP", effectiveFrom: daysFromNow(-300) },
    ]);

    await db.insert(loanTranches).values([
        { loanId: loanIds.active1, trancheNumber: 1, amount: "1000000", disbursementDate: daysFromNow(-180) },
        { loanId: loanIds.active2, trancheNumber: 1, amount: "300000", disbursementDate: daysFromNow(-150) },
        { loanId: loanIds.overdue1, trancheNumber: 1, amount: "500000", disbursementDate: daysFromNow(-90) },
        { loanId: loanIds.npa1, trancheNumber: 1, amount: "2000000", disbursementDate: daysFromNow(-200) },
        { loanId: loanIds.closed1, trancheNumber: 1, amount: "300000", disbursementDate: daysFromNow(-370) },
        { loanId: loanIds.active3, trancheNumber: 1, amount: "2000000", disbursementDate: daysFromNow(-300), remarks: "First construction milestone" },
        { loanId: loanIds.active3, trancheNumber: 2, amount: "1000000", disbursementDate: daysFromNow(-150), remarks: "Second construction milestone" },
    ]);
}

/* ============================================================
   STATUS HISTORY (drives Loan Closure / Write-Off accounting exports)
============================================================ */

async function seedStatusHistory(loanIds: Awaited<ReturnType<typeof seedLoans>>) {
    await db.insert(loanStatusHistory).values([
        { loanId: loanIds.closed1, fromStatus: "ACTIVE", toStatus: "CLOSED", reason: "Loan fully repaid ahead of schedule.", changedAt: new Date(Date.now() - 10 * 86400000) },
        { loanId: loanIds.writtenOff1, fromStatus: "NPA", toStatus: "WRITTEN_OFF", reason: "Recovery avenues exhausted; written off per policy.", changedAt: new Date(Date.now() - 5 * 86400000) },
        { loanId: loanIds.npa1, fromStatus: "OVERDUE", toStatus: "NPA", reason: "Overdue beyond 90 days.", changedAt: new Date(Date.now() - 95 * 86400000) },
    ]);
}

/* ============================================================
   REPAYMENT SCHEDULES + INSTALLMENTS + PAYMENTS + ALLOCATIONS
============================================================ */

async function seedRepaymentsAndPayments(loanIds: Awaited<ReturnType<typeof seedLoans>>) {
    let paymentRefCounter = 1;
    const nextRef = (loanCode: string) => `SEED-PAY-${loanCode}-${String(paymentRefCounter++).padStart(3, "0")}`;

    async function seedEmiLoan(
        loanId: string,
        loanCode: string,
        installmentPlan: Array<{
            due: number;
            principal: string;
            interest: string;
            status: "SUCCESS" | "PARTIAL" | "PENDING";
            paidPrincipal: string;
            paidInterest: string;
            paidDateOffset?: number;
        }>,
        paymentMode: "NEFT" | "UPI" | "BANK_TRANSFER" | "RTGS" = "NEFT",
    ) {
        const [schedule] = await db
            .insert(repaymentSchedules)
            .values({ loanId, version: 1, isCurrent: true })
            .returning({ id: repaymentSchedules.id });

        for (const inst of installmentPlan) {
            const total = (Number(inst.principal) + Number(inst.interest)).toFixed(2);
            const paidTotal = (Number(inst.paidPrincipal) + Number(inst.paidInterest)).toFixed(2);

            const [installmentRow] = await db
                .insert(installments)
                .values({
                    scheduleId: schedule!.id,
                    installmentNumber: installmentPlan.indexOf(inst) + 1,
                    dueDate: daysFromNow(inst.due),
                    principalAmount: inst.principal,
                    interestAmount: inst.interest,
                    totalAmount: total,
                    paidPrincipal: inst.paidPrincipal,
                    paidInterest: inst.paidInterest,
                    paidTotal,
                    status: inst.status,
                    paidDate: inst.paidDateOffset !== undefined ? daysFromNow(inst.paidDateOffset) : null,
                })
                .returning({ id: installments.id });

            if (inst.status === "SUCCESS" || inst.status === "PARTIAL") {
                const [payment] = await db
                    .insert(payments)
                    .values({
                        paymentRefNumber: nextRef(loanCode),
                        loanId,
                        amount: paidTotal,
                        paymentDate: daysFromNow(inst.paidDateOffset ?? inst.due),
                        paymentMode,
                        status: "SUCCESS",
                        transactionRef: `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
                        remarks: `EMI #${installmentPlan.indexOf(inst) + 1}`,
                    })
                    .returning({ id: payments.id });

                await db.insert(paymentAllocations).values({
                    paymentId: payment!.id,
                    installmentId: installmentRow!.id,
                    principalApplied: inst.paidPrincipal,
                    interestApplied: inst.paidInterest,
                });
            }
        }
    }

    // Loan 1: 5 EMIs, 4 fully paid, 1 pending.
    await seedEmiLoan(
        loanIds.active1,
        "ACT1",
        [
            { due: -150, principal: "41667", interest: "10417", status: "SUCCESS", paidPrincipal: "41667", paidInterest: "10417", paidDateOffset: -149 },
            { due: -120, principal: "41667", interest: "9983", status: "SUCCESS", paidPrincipal: "41667", paidInterest: "9983", paidDateOffset: -119 },
            { due: -90, principal: "41667", interest: "9549", status: "SUCCESS", paidPrincipal: "41667", paidInterest: "9549", paidDateOffset: -88 },
            { due: -60, principal: "41667", interest: "9115", status: "SUCCESS", paidPrincipal: "41667", paidInterest: "9115", paidDateOffset: -57 },
            { due: -30, principal: "41667", interest: "8681", status: "PENDING", paidPrincipal: "0", paidInterest: "0" },
        ],
        "NEFT",
    );

    // Loan 2: 4 EMIs, 3 paid, 1 pending.
    await seedEmiLoan(
        loanIds.active2,
        "ACT2",
        [
            { due: -120, principal: "25000", interest: "3375", status: "SUCCESS", paidPrincipal: "25000", paidInterest: "3375", paidDateOffset: -118 },
            { due: -90, principal: "25000", interest: "3094", status: "SUCCESS", paidPrincipal: "25000", paidInterest: "3094", paidDateOffset: -89 },
            { due: -60, principal: "25000", interest: "2813", status: "SUCCESS", paidPrincipal: "25000", paidInterest: "2813", paidDateOffset: -55 },
            { due: -30, principal: "25000", interest: "2531", status: "PENDING", paidPrincipal: "0", paidInterest: "0" },
        ],
        "UPI",
    );

    // Loan 3 (overdue): matches the original dashboard demo numbers — paid / pending / partial / pending.
    await seedEmiLoan(
        loanIds.overdue1,
        "OD1",
        [
            { due: -45, principal: "40000", interest: "5000", status: "SUCCESS", paidPrincipal: "40000", paidInterest: "5000", paidDateOffset: -44 },
            { due: -15, principal: "40000", interest: "4800", status: "PENDING", paidPrincipal: "0", paidInterest: "0" },
            { due: -5, principal: "40000", interest: "4600", status: "PARTIAL", paidPrincipal: "10000", paidInterest: "0", paidDateOffset: -4 },
            { due: 15, principal: "40000", interest: "4400", status: "PENDING", paidPrincipal: "0", paidInterest: "0" },
        ],
        "BANK_TRANSFER",
    );

    // A standalone penalty payment against the overdue loan (not tied to a specific installment).
    const [penaltyPayment] = await db
        .insert(payments)
        .values({
            paymentRefNumber: nextRef("OD1-PEN"),
            loanId: loanIds.overdue1,
            amount: "1200",
            paymentDate: daysFromNow(-4),
            paymentMode: "UPI",
            status: "SUCCESS",
            transactionRef: `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
            remarks: "Penal interest for late installment #3",
        })
        .returning({ id: payments.id });

    await db.insert(paymentAllocations).values({
        paymentId: penaltyPayment!.id,
        penalInterestApplied: "1200",
    });

    // Loan 5 (closed): 4 EMIs, all paid in full.
    await seedEmiLoan(
        loanIds.closed1,
        "CLS1",
        [
            { due: -100, principal: "75000", interest: "2750", status: "SUCCESS", paidPrincipal: "75000", paidInterest: "2750", paidDateOffset: -99 },
            { due: -70, principal: "75000", interest: "2062", status: "SUCCESS", paidPrincipal: "75000", paidInterest: "2062", paidDateOffset: -68 },
            { due: -40, principal: "75000", interest: "1375", status: "SUCCESS", paidPrincipal: "75000", paidInterest: "1375", paidDateOffset: -38 },
            { due: -10, principal: "75000", interest: "688", status: "SUCCESS", paidPrincipal: "75000", paidInterest: "688", paidDateOffset: -10 },
        ],
        "RTGS",
    );

    // Loan 8 (structured, active3): one interest-only payment during the moratorium phase.
    const [interestOnlyPayment] = await db
        .insert(payments)
        .values({
            paymentRefNumber: nextRef("ACT3"),
            loanId: loanIds.active3,
            amount: "30000",
            paymentDate: daysFromNow(-60),
            paymentMode: "NEFT",
            status: "SUCCESS",
            transactionRef: `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
            remarks: "Interest-only payment during construction phase",
        })
        .returning({ id: payments.id });

    await db.insert(paymentAllocations).values({
        paymentId: interestOnlyPayment!.id,
        interestApplied: "30000",
    });
}

/* ============================================================
   COLLATERAL + INSURANCE (via real service — exercises LTV calc)
============================================================ */

async function seedCollateral(loanIds: Awaited<ReturnType<typeof seedLoans>>) {
    const c1 = await CollateralService.createCollateral({
        loanId: loanIds.active1,
        securityType: "PROPERTY",
        description: "Commercial shop premises, Andheri East",
        propertyType: "Commercial",
        propertyAddress: "Shop No. 12, Andheri Industrial Estate, Mumbai",
        surveyNumber: "SVY-2201",
        areaInSqFt: "850",
        estimatedValue: "1500000",
        valuationDate: daysFromNow(-185),
        valuationBy: "ABC Valuers Pvt Ltd",
    });

    await CollateralService.updateInsurance(c1.id, {
        policyNumber: "POL-AAN-100234",
        insurer: "National Insurance Co.",
        insuredAmount: "1500000",
        premiumAmount: "12500",
        startDate: daysFromNow(-185),
        expiryDate: daysFromNow(180),
    });

    const c2 = await CollateralService.createCollateral({
        loanId: loanIds.npa1,
        securityType: "PROPERTY",
        description: "Warehouse facility, GIDC Ahmedabad",
        propertyType: "Industrial",
        propertyAddress: "Plot 45, GIDC Estate, Ahmedabad",
        surveyNumber: "SVY-5567",
        areaInSqFt: "4200",
        estimatedValue: "2400000",
        valuationDate: daysFromNow(-205),
        valuationBy: "XYZ Valuation Services",
    });

    await CollateralService.updateInsurance(c2.id, {
        policyNumber: "POL-AAN-098765",
        insurer: "United India Insurance",
        insuredAmount: "2400000",
        premiumAmount: "18000",
        startDate: daysFromNow(-400),
        expiryDate: daysFromNow(-35), // expired — realistic for an NPA account
    });

    await CollateralService.createCollateral({
        loanId: loanIds.closed1,
        securityType: "PROPERTY",
        description: "Machinery hypothecation — since released",
        propertyType: "Plant & Machinery",
        estimatedValue: "350000",
        valuationDate: daysFromNow(-372),
        valuationBy: "ABC Valuers Pvt Ltd",
    });

    const c4 = await CollateralService.createCollateral({
        loanId: loanIds.active3,
        securityType: "MORTGAGE",
        description: "Under-construction commercial complex, Surat",
        propertyType: "Commercial",
        propertyAddress: "Survey 88/2, Ring Road, Surat",
        surveyNumber: "SVY-8802",
        areaInSqFt: "12000",
        estimatedValue: "6500000",
        valuationDate: daysFromNow(-302),
        valuationBy: "National Valuers LLP",
        mortgageType: "Registered Mortgage",
        mortgageDate: daysFromNow(-300),
        mortgageDeedNumber: "MTG-DEED-3391",
    });

    await CollateralService.updateInsurance(c4.id, {
        policyNumber: "POL-AAN-556677",
        insurer: "New India Assurance",
        insuredAmount: "6500000",
        premiumAmount: "42000",
        startDate: daysFromNow(-300),
        expiryDate: daysFromNow(65),
    });
}

/* ============================================================
   COLLECTIONS ACTIVITY (via real service — exercises case auto-creation)
============================================================ */

async function seedCollections(loanIds: Awaited<ReturnType<typeof seedLoans>>) {
    // Overdue loan — an open follow-up trail with an active (unresolved) promise.
    await CollectionsService.createActivity({
        loanId: loanIds.overdue1,
        activityType: "CALL",
        followUpDate: daysFromNow(-4),
        contactPerson: "Rajesh Kumar",
        remarks: "Spoke with borrower — cited temporary cash flow issue.",
    });

    await CollectionsService.createActivity({
        loanId: loanIds.overdue1,
        activityType: "REMINDER_SENT",
        followUpDate: daysFromNow(-2),
        contactPerson: "Rajesh Kumar",
        remarks: "SMS + email reminder sent for installment #2.",
    });

    const promiseActivity = await CollectionsService.createActivity({
        loanId: loanIds.overdue1,
        activityType: "PROMISE_TO_PAY_CREATED",
        followUpDate: daysFromNow(3),
        contactPerson: "Rajesh Kumar",
        remarks: "Borrower committed to clearing the overdue installment.",
    });

    await CollectionsService.createPromiseToPay(promiseActivity.id, {
        promiseDate: daysFromNow(7),
        promiseAmount: "45000",
    });

    // NPA loan — escalated activity trail including a broken promise and a legal notice.
    await CollectionsService.createActivity({
        loanId: loanIds.npa1,
        activityType: "BRANCH_VISIT",
        followUpDate: daysFromNow(-30),
        contactPerson: "Vikram Mehta (Director)",
        remarks: "Field visit — company premises found operational but cash-strapped.",
    });

    const brokenPromise = await CollectionsService.createActivity({
        loanId: loanIds.npa1,
        activityType: "PROMISE_TO_PAY_CREATED",
        followUpDate: daysFromNow(-20),
        contactPerson: "Vikram Mehta (Director)",
        remarks: "Promised partial settlement.",
    });

    await CollectionsService.createPromiseToPay(brokenPromise.id, {
        promiseDate: daysFromNow(-15),
        promiseAmount: "200000",
    });

    await CollectionsService.closePromiseToPay(brokenPromise.id, {
        kept: false,
        remarks: "Promise not honored — no payment received by promised date.",
    });

    await CollectionsService.createActivity({
        loanId: loanIds.npa1,
        activityType: "LEGAL_NOTICE",
        followUpDate: daysFromNow(5),
        contactPerson: "Vikram Mehta (Director)",
        remarks: "Legal notice issued for recovery proceedings.",
    });
}

/* ============================================================
   DOCUMENTS (real Supabase Storage upload via DocumentService)
============================================================ */

async function seedDocuments(
    borrowerIds: Awaited<ReturnType<typeof seedBorrowers>>,
    loanIds: Awaited<ReturnType<typeof seedLoans>>,
) {
    const uploads: Array<{
        entityType: "BORROWER" | "LOAN";
        entityId: string;
        documentType: string;
        name: string;
    }> = [
        { entityType: "BORROWER", entityId: borrowerIds.rajesh, documentType: "KYC", name: "PAN Card - Rajesh Kumar Traders" },
        { entityType: "LOAN", entityId: loanIds.active1, documentType: "SANCTION_LETTER", name: "Sanction Letter - SEED-LN-ACTIVE-001" },
        { entityType: "LOAN", entityId: loanIds.active1, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-ACTIVE-001" },

        { entityType: "BORROWER", entityId: borrowerIds.priya, documentType: "KYC", name: "Aadhaar - Priya Sharma" },
        { entityType: "LOAN", entityId: loanIds.active2, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-ACTIVE-002" },

        { entityType: "LOAN", entityId: loanIds.overdue1, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-OVERDUE-001" },

        { entityType: "BORROWER", entityId: borrowerIds.vikram, documentType: "KYC", name: "GST Certificate - Vikram Enterprises" },
        { entityType: "LOAN", entityId: loanIds.npa1, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-NPA-001" },
        { entityType: "LOAN", entityId: loanIds.npa1, documentType: "MORTGAGE_DEED", name: "Mortgage Deed - SEED-LN-NPA-001" },
        { entityType: "LOAN", entityId: loanIds.npa1, documentType: "LEGAL_OPINION", name: "Legal Opinion - SEED-LN-NPA-001" },

        { entityType: "LOAN", entityId: loanIds.closed1, documentType: "SANCTION_LETTER", name: "Sanction Letter - SEED-LN-CLOSED-001" },
        { entityType: "LOAN", entityId: loanIds.closed1, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-CLOSED-001" },

        { entityType: "BORROWER", entityId: borrowerIds.sunita, documentType: "KYC", name: "PAN Card - Sunita Devi" },
        { entityType: "LOAN", entityId: loanIds.writtenOff1, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-WRITTENOFF-001" },
        { entityType: "LOAN", entityId: loanIds.pending1, documentType: "KYC", name: "Income Proof - SEED-LN-PENDING-001" },

        { entityType: "LOAN", entityId: loanIds.active3, documentType: "LOAN_AGREEMENT", name: "Loan Agreement - SEED-LN-ACTIVE-003" },
        { entityType: "LOAN", entityId: loanIds.active3, documentType: "MORTGAGE_DEED", name: "Mortgage Deed - SEED-LN-ACTIVE-003" },
        { entityType: "LOAN", entityId: loanIds.active3, documentType: "VALUATION_REPORT", name: "Valuation Report - SEED-LN-ACTIVE-003" },
    ];

    let uploaded = 0;
    let failed = 0;

    for (const item of uploads) {
        try {
            await DocumentService.upload({
                entityType: item.entityType,
                entityId: item.entityId,
                documentType: item.documentType,
                name: item.name,
                remarks: "Seed data placeholder — not a real document.",
                file: {
                    buffer: PLACEHOLDER_PNG,
                    originalName: `${item.name}.png`,
                    mimeType: "image/png",
                    size: PLACEHOLDER_PNG.byteLength,
                },
            });
            uploaded++;
        } catch (error) {
            failed++;
            console.warn(
                `  ! Failed to upload document "${item.name}" (Supabase Storage may be unreachable/misconfigured): ${
                    error instanceof Error ? error.message : error
                }`,
            );
        }
    }

    console.log(`Documents: ${uploaded} uploaded, ${failed} failed.`);
}

/* ============================================================
   ENTRY POINT
============================================================ */

export async function seedAll(): Promise<void> {
    console.log("Seeding borrowers...");
    const borrowerIds = await seedBorrowers();

    console.log("Seeding loans...");
    const loanIds = await seedLoans(borrowerIds);

    console.log("Seeding interest configs + disbursement tranches...");
    await seedInterestAndTranches(loanIds);

    console.log("Seeding loan status history...");
    await seedStatusHistory(loanIds);

    console.log("Seeding repayment schedules, installments, payments + allocations...");
    await seedRepaymentsAndPayments(loanIds);

    console.log("Seeding collateral + insurance...");
    await seedCollateral(loanIds);

    console.log("Seeding collections activity...");
    await seedCollections(loanIds);

    console.log("Seeding documents (real Supabase Storage upload)...");
    await seedDocuments(borrowerIds, loanIds);

    console.log("\nSeed complete:");
    console.log(`  ${Object.keys(borrowerIds).length} borrowers`);
    console.log(`  ${Object.keys(loanIds).length} loans (one per status: PENDING, ACTIVE x2, OVERDUE, NPA, CLOSED, WRITTEN_OFF)`);
}

const isMainModule =
    process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    (async () => {
        await clearSeedData();
        await seedAll();
        process.exit(0);
    })().catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    });
}
