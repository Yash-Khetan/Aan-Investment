import { inArray } from "drizzle-orm";

import { db } from "../index.js";
import { borrowers, collectionCases, installments, loans, repaymentSchedules } from "../schema/index.js";

export interface DashboardSeedIds {
    borrowerIds: string[];
    loanIds: string[];
    collectionCaseIds: string[];
}

function daysFromNow(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

export async function seedDashboardData(): Promise<DashboardSeedIds> {
    const insertedBorrowers = await db
        .insert(borrowers)
        .values([
            { borrowerCode: "SEED-BRW-001", name: "Seed Borrower One", constitution: "INDIVIDUAL" },
            { borrowerCode: "SEED-BRW-002", name: "Seed Borrower Two", constitution: "PRIVATE_LIMITED" },
        ])
        .returning({ id: borrowers.id });

    const borrowerOne = insertedBorrowers[0]!;
    const borrowerTwo = insertedBorrowers[1]!;

    const insertedLoans = await db
        .insert(loans)
        .values([
            {
                loanAccountNumber: "SEED-LN-ACTIVE-001",
                borrowerId: borrowerOne.id,
                loanType: "SECURED",
                repaymentType: "EMI",
                sanctionedAmount: "1000000",
                disbursedAmount: "1000000",
                outstandingPrincipal: "800000",
                interestRate: "12.5",
                tenureMonths: 24,
                status: "ACTIVE",
            },
            {
                loanAccountNumber: "SEED-LN-OVERDUE-001",
                borrowerId: borrowerOne.id,
                loanType: "UNSECURED",
                repaymentType: "EMI",
                sanctionedAmount: "500000",
                disbursedAmount: "500000",
                outstandingPrincipal: "420000",
                interestRate: "14",
                tenureMonths: 12,
                status: "OVERDUE",
            },
            {
                loanAccountNumber: "SEED-LN-NPA-001",
                borrowerId: borrowerTwo.id,
                loanType: "SECURED",
                repaymentType: "BULLET",
                sanctionedAmount: "2000000",
                disbursedAmount: "2000000",
                outstandingPrincipal: "2000000",
                interestRate: "15",
                tenureMonths: 6,
                status: "NPA",
            },
            {
                loanAccountNumber: "SEED-LN-CLOSED-001",
                borrowerId: borrowerTwo.id,
                loanType: "SECURED",
                repaymentType: "EMI",
                sanctionedAmount: "300000",
                disbursedAmount: "300000",
                outstandingPrincipal: "0",
                interestRate: "11",
                tenureMonths: 12,
                status: "CLOSED",
            },
            {
                loanAccountNumber: "SEED-LN-PENDING-001",
                borrowerId: borrowerTwo.id,
                loanType: "UNSECURED",
                repaymentType: "EMI",
                sanctionedAmount: "150000",
                disbursedAmount: "0",
                outstandingPrincipal: "0",
                interestRate: "13",
                tenureMonths: 12,
                status: "PENDING",
            },
        ])
        .returning({ id: loans.id, accountNumber: loans.loanAccountNumber });

    const overdueLoan = insertedLoans.find((l) => l.accountNumber === "SEED-LN-OVERDUE-001")!;
    const npaLoan = insertedLoans.find((l) => l.accountNumber === "SEED-LN-NPA-001")!;

    const [schedule] = await db
        .insert(repaymentSchedules)
        .values({ loanId: overdueLoan.id, version: 1, isCurrent: true })
        .returning({ id: repaymentSchedules.id });

    await db.insert(installments).values([
        {
            scheduleId: schedule!.id,
            installmentNumber: 1,
            dueDate: daysFromNow(-45),
            principalAmount: "40000",
            interestAmount: "5000",
            totalAmount: "45000",
            paidPrincipal: "40000",
            paidInterest: "5000",
            paidTotal: "45000",
            status: "SUCCESS",
            paidDate: daysFromNow(-44),
        },
        {
            scheduleId: schedule!.id,
            installmentNumber: 2,
            dueDate: daysFromNow(-15),
            principalAmount: "40000",
            interestAmount: "4800",
            totalAmount: "44800",
            paidPrincipal: "0",
            paidInterest: "0",
            paidTotal: "0",
            status: "PENDING",
        },
        {
            scheduleId: schedule!.id,
            installmentNumber: 3,
            dueDate: daysFromNow(-5),
            principalAmount: "40000",
            interestAmount: "4600",
            totalAmount: "44600",
            paidPrincipal: "10000",
            paidInterest: "0",
            paidTotal: "10000",
            status: "PARTIAL",
        },
        {
            scheduleId: schedule!.id,
            installmentNumber: 4,
            dueDate: daysFromNow(15),
            principalAmount: "40000",
            interestAmount: "4400",
            totalAmount: "44400",
            paidPrincipal: "0",
            paidInterest: "0",
            paidTotal: "0",
            status: "PENDING",
        },
    ]);

    const insertedCases = await db
        .insert(collectionCases)
        .values([
            {
                loanId: overdueLoan.id,
                borrowerId: borrowerOne.id,
                status: "FOLLOW_UP",
                overdueAmount: "89400",
                nextFollowUpDate: daysFromNow(3),
                remarks: "Seed data for dashboard testing",
            },
            {
                loanId: npaLoan.id,
                borrowerId: borrowerTwo.id,
                status: "OPEN",
                overdueAmount: "2000000",
                nextFollowUpDate: daysFromNow(1),
                remarks: "Seed data for dashboard testing",
            },
            {
                loanId: npaLoan.id,
                borrowerId: borrowerTwo.id,
                status: "PROMISE_TO_PAY",
                overdueAmount: "50000",
                nextFollowUpDate: daysFromNow(20),
                remarks: "Seed data for dashboard testing",
            },
        ])
        .returning({ id: collectionCases.id });

    return {
        borrowerIds: insertedBorrowers.map((b) => b.id),
        loanIds: insertedLoans.map((l) => l.id),
        collectionCaseIds: insertedCases.map((c) => c.id),
    };
}

export async function clearDashboardData(ids: DashboardSeedIds): Promise<void> {
    if (ids.collectionCaseIds.length) {
        await db.delete(collectionCases).where(inArray(collectionCases.id, ids.collectionCaseIds));
    }
    if (ids.loanIds.length) {
        await db.delete(loans).where(inArray(loans.id, ids.loanIds));
    }
    if (ids.borrowerIds.length) {
        await db.delete(borrowers).where(inArray(borrowers.id, ids.borrowerIds));
    }
}
