/**
 * The smallest real rows a ledger test needs: a user to act, a borrower, a
 * loan, and the one interest configuration every loan is created with.
 *
 * Written straight through `testDb` rather than through the Loan module's
 * service, so a ledger test depends on the ledger's own code and on the
 * schema, not on loan creation.
 */

import { eq } from "drizzle-orm";

import {
    borrowers,
    interestConfigs,
    loans,
    permissions,
    rolePermissions,
    roles,
    userRoles,
    users,
} from "../db/schema";
import { testDb } from "./testDb";

let sequence = 0;

export interface SeededLoan {
    userId: string;
    borrowerId: string;
    loanId: string;
}

/**
 * One loan, ready to post ledger entries to. The interest configuration is
 * the project's own default shape: 21% a year, 10% TDS, ACTUAL_365, effective
 * from `effectiveFrom`.
 */
export async function seedLoan(
    options: {
        effectiveFrom?: string;
        annualRate?: string;
        tdsRatePercent?: string;
        interestBasis?: "ACTUAL_365" | "ACTUAL_360" | "MONTHLY_RATE_ACTUAL_30" | "FIXED_MONTHLY";
        maturityDate?: string;
    } = {},
): Promise<SeededLoan> {
    sequence += 1;
    const tag = String(sequence).padStart(4, "0");

    const [user] = await testDb
        .insert(users)
        .values({
            firstName: "Test",
            lastName: "Operator",
            email: `operator-${tag}@example.test`,
            passwordHash: "not-a-real-hash",
            isEmailVerified: true,
            isActive: true,
        })
        .returning({ id: users.id });

    const [borrower] = await testDb
        .insert(borrowers)
        .values({
            borrowerType: "COMMERCIAL",
            borrowerCode: `BRW-${tag}`,
            name: `Test Borrower ${tag}`,
            constitution: "PRIVATE_LIMITED",
        })
        .returning({ id: borrowers.id });

    const [loan] = await testDb
        .insert(loans)
        .values({
            loanAccountNumber: `LN-${tag}`,
            borrowerId: borrower!.id,
            loanType: "UNSECURED",
            repaymentType: "BULLET",
            sanctionedAmount: "10000000.00",
            tenureMonths: 24,
            sanctionDate: options.effectiveFrom ?? "2024-01-01",
            maturityDate: options.maturityDate ?? "2026-01-01",
            status: "ACTIVE",
            createdBy: user!.id,
        })
        .returning({ id: loans.id });

    await testDb.insert(interestConfigs).values({
        loanId: loan!.id,
        annualRate: options.annualRate ?? "21.0000",
        tdsRatePercent: options.tdsRatePercent ?? "10.00",
        interestBasis: options.interestBasis ?? "ACTUAL_365",
        effectiveFrom: options.effectiveFrom ?? "2024-01-01",
        isCurrent: true,
        includeOpeningClosingDays: false,
    });

    return { userId: user!.id, borrowerId: borrower!.id, loanId: loan!.id };
}

/**
 * Gives a user a role holding exactly `permissionNames` — the graph the RBAC
 * engine reads (user_roles → role_permissions → permissions).
 */
export async function grantPermissions(userId: string, roleName: string, permissionNames: string[]): Promise<void> {
    const [role] = await testDb
        .insert(roles)
        .values({ name: roleName, description: `${roleName} for tests`, isSystemRole: false, isActive: true })
        .returning({ id: roles.id });

    for (const name of permissionNames) {
        await testDb
            .insert(permissions)
            .values({ name, description: name })
            .onConflictDoNothing({ target: permissions.name });

        const [permission] = await testDb
            .select({ id: permissions.id })
            .from(permissions)
            .where(eq(permissions.name, name))
            .limit(1);

        await testDb.insert(rolePermissions).values({ roleId: role!.id, permissionId: permission!.id });
    }

    await testDb.insert(userRoles).values({ userId, roleId: role!.id });
}
