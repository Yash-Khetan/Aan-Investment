import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";

import { db } from "../../../db/index.js";
import {
    borrowers,
    installments,
    loans,
    loanStatusHistory,
    loanTranches,
    paymentAllocations,
    payments,
} from "../../../db/schema/index.js";
import { ACCOUNT_MAPPING } from "../constants/account-mapping.constants.js";
import { buildCsv } from "../exporters/csv.exporter.js";
import { buildExcelBuffer } from "../exporters/excel.exporter.js";
import { toAmount } from "../utils/amount.utils.js";
import { toDisplayDate, toDisplayTimestamp } from "../utils/date.utils.js";
import { logger } from "../utils/logger.utils.js";
import type {
    AccountingEntryRow,
    AccountingExportFilters,
    AccountingExportResult,
    TransactionType,
} from "../types/accounting-export.types.js";

/* ============================================================
   SHARED FILTER HELPERS
============================================================ */

function categoryIsExcluded(
    filters: AccountingExportFilters,
    category: TransactionType,
): boolean {
    return filters.transactionType !== undefined && filters.transactionType !== category;
}

function buildResult(
    rows: AccountingEntryRow[],
    filters: AccountingExportFilters,
    notes?: string,
): AccountingExportResult {
    return {
        rows,
        count: rows.length,
        generatedAt: new Date().toISOString(),
        filters,
        notes,
    };
}

function branchNote(filters: AccountingExportFilters): string | undefined {
    if (filters.branchId === undefined) {
        return undefined;
    }

    return "branchId filter was ignored: the schema does not yet model branches.";
}

/* ============================================================
   ACCOUNTING EXPORT SERVICE
   Read-only. Every method issues a single joined SQL query —
   no per-row follow-up queries (no N+1).
============================================================ */

export class AccountingExportService {
    /* ---------- Principal / Interest / Penalty (payment allocations) ---------- */

    private async getPaymentAllocationEntries(
        filters: AccountingExportFilters,
        category: Extract<
            TransactionType,
            "PRINCIPAL_RECEIVED" | "INTEREST_RECEIVED" | "PENALTY_CHARGES"
        >,
    ): Promise<AccountingExportResult> {
        if (categoryIsExcluded(filters, category)) {
            return buildResult([], filters, branchNote(filters));
        }

        const conditions: SQL[] = [eq(payments.status, "SUCCESS")];

        if (filters.loanId) {
            conditions.push(eq(loans.id, filters.loanId));
        }

        if (filters.customerId) {
            conditions.push(eq(borrowers.id, filters.customerId));
        }

        if (filters.startDate) {
            conditions.push(gte(payments.paymentDate, filters.startDate));
        }

        if (filters.endDate) {
            conditions.push(lte(payments.paymentDate, filters.endDate));
        }

        const results = await db
            .select({
                paymentDate: payments.paymentDate,
                loanAccountNumber: loans.loanAccountNumber,
                borrowerName: borrowers.name,
                paymentRefNumber: payments.paymentRefNumber,
                transactionRef: payments.transactionRef,
                principalApplied: paymentAllocations.principalApplied,
                interestApplied: paymentAllocations.interestApplied,
                penalInterestApplied: paymentAllocations.penalInterestApplied,
                installmentNumber: installments.installmentNumber,
                remarks: payments.remarks,
                createdAt: paymentAllocations.createdAt,
            })
            .from(paymentAllocations)
            .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
            .innerJoin(loans, eq(payments.loanId, loans.id))
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .leftJoin(installments, eq(paymentAllocations.installmentId, installments.id))
            .where(and(...conditions))
            .orderBy(desc(payments.paymentDate));

        const account = ACCOUNT_MAPPING[category];

        const rows: AccountingEntryRow[] = results
            .map((row) => {
                const principalAmount = toAmount(row.principalApplied);
                const interestAmount = toAmount(row.interestApplied);
                const penaltyAmount = toAmount(row.penalInterestApplied);

                const amount =
                    category === "PRINCIPAL_RECEIVED"
                        ? principalAmount
                        : category === "INTEREST_RECEIVED"
                          ? interestAmount
                          : penaltyAmount;

                return {
                    transactionDate: toDisplayDate(row.paymentDate),
                    loanNumber: row.loanAccountNumber,
                    customerName: row.borrowerName,
                    transactionType: category,
                    referenceNumber: row.transactionRef ?? row.paymentRefNumber,
                    debitAccount: account.debitAccount,
                    creditAccount: account.creditAccount,
                    principalAmount: category === "PRINCIPAL_RECEIVED" ? amount : 0,
                    interestAmount: category === "INTEREST_RECEIVED" ? amount : 0,
                    penaltyAmount: category === "PENALTY_CHARGES" ? amount : 0,
                    fees: 0,
                    taxAmount: 0,
                    totalAmount: amount,
                    remarks:
                        row.remarks ??
                        (row.installmentNumber
                            ? `Installment #${row.installmentNumber}`
                            : ""),
                    createdAt: toDisplayTimestamp(row.createdAt),
                };
            })
            .filter((row) => row.totalAmount > 0);

        return buildResult(rows, filters, branchNote(filters));
    }

    async getPrincipalEntries(filters: AccountingExportFilters): Promise<AccountingExportResult> {
        return this.getPaymentAllocationEntries(filters, "PRINCIPAL_RECEIVED");
    }

    async getInterestEntries(filters: AccountingExportFilters): Promise<AccountingExportResult> {
        return this.getPaymentAllocationEntries(filters, "INTEREST_RECEIVED");
    }

    async getPenaltyEntries(filters: AccountingExportFilters): Promise<AccountingExportResult> {
        return this.getPaymentAllocationEntries(filters, "PENALTY_CHARGES");
    }

    /* ---------- Loan Disbursement ---------- */

    async getLoanDisbursements(
        filters: AccountingExportFilters,
    ): Promise<AccountingExportResult> {
        const category: TransactionType = "LOAN_DISBURSEMENT";

        if (categoryIsExcluded(filters, category)) {
            return buildResult([], filters, branchNote(filters));
        }

        const conditions: SQL[] = [];

        if (filters.loanId) {
            conditions.push(eq(loans.id, filters.loanId));
        }

        if (filters.customerId) {
            conditions.push(eq(borrowers.id, filters.customerId));
        }

        if (filters.startDate) {
            conditions.push(gte(loanTranches.disbursementDate, filters.startDate));
        }

        if (filters.endDate) {
            conditions.push(lte(loanTranches.disbursementDate, filters.endDate));
        }

        const results = await db
            .select({
                disbursementDate: loanTranches.disbursementDate,
                loanAccountNumber: loans.loanAccountNumber,
                borrowerName: borrowers.name,
                trancheNumber: loanTranches.trancheNumber,
                loanId: loanTranches.loanId,
                amount: loanTranches.amount,
                remarks: loanTranches.remarks,
                createdAt: loanTranches.createdAt,
            })
            .from(loanTranches)
            .innerJoin(loans, eq(loanTranches.loanId, loans.id))
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(loanTranches.disbursementDate));

        const account = ACCOUNT_MAPPING[category];

        const rows: AccountingEntryRow[] = results.map((row) => {
            const principalAmount = toAmount(row.amount);

            return {
                transactionDate: toDisplayDate(row.disbursementDate),
                loanNumber: row.loanAccountNumber,
                customerName: row.borrowerName,
                transactionType: category,
                referenceNumber: `${row.loanAccountNumber}-TR${row.trancheNumber}`,
                debitAccount: account.debitAccount,
                creditAccount: account.creditAccount,
                principalAmount,
                interestAmount: 0,
                penaltyAmount: 0,
                fees: 0,
                taxAmount: 0,
                totalAmount: principalAmount,
                remarks: row.remarks ?? `Tranche #${row.trancheNumber}`,
                createdAt: toDisplayTimestamp(row.createdAt),
            };
        });

        return buildResult(rows, filters, branchNote(filters));
    }

    /* ---------- Loan Closure / Write-Off ----------
       loans.status is the authoritative source of truth; loanStatusHistory
       is used only to enrich the entry with an accurate transaction date
       and reason when a matching audit row exists. Loans are never
       dropped just because their history trail is incomplete. Two
       queries total (loans, then history for that loan set) — no N+1. */

    private async getStatusDrivenEntries(
        filters: AccountingExportFilters,
        category: Extract<TransactionType, "LOAN_CLOSURE" | "LOAN_WRITE_OFF">,
        toStatus: "CLOSED" | "WRITTEN_OFF",
    ): Promise<AccountingExportResult> {
        if (categoryIsExcluded(filters, category)) {
            return buildResult([], filters, branchNote(filters));
        }

        const conditions: SQL[] = [eq(loans.status, toStatus)];

        if (filters.loanId) {
            conditions.push(eq(loans.id, filters.loanId));
        }

        if (filters.customerId) {
            conditions.push(eq(borrowers.id, filters.customerId));
        }

        const loanRows = await db
            .select({
                loanId: loans.id,
                loanAccountNumber: loans.loanAccountNumber,
                borrowerName: borrowers.name,
                outstandingPrincipal: loans.outstandingPrincipal,
                disbursedAmount: loans.disbursedAmount,
                remarks: loans.remarks,
                updatedAt: loans.updatedAt,
            })
            .from(loans)
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .where(and(...conditions));

        if (loanRows.length === 0) {
            return buildResult([], filters, branchNote(filters));
        }

        const loanIds = loanRows.map((row) => row.loanId);

        const historyRows = await db
            .select({
                loanId: loanStatusHistory.loanId,
                changedAt: loanStatusHistory.changedAt,
                reason: loanStatusHistory.reason,
            })
            .from(loanStatusHistory)
            .where(
                and(
                    eq(loanStatusHistory.toStatus, toStatus),
                    inArray(loanStatusHistory.loanId, loanIds),
                ),
            )
            .orderBy(desc(loanStatusHistory.changedAt));

        const latestHistoryByLoan = new Map<string, { changedAt: Date | null; reason: string | null }>();

        for (const history of historyRows) {
            if (!latestHistoryByLoan.has(history.loanId)) {
                latestHistoryByLoan.set(history.loanId, {
                    changedAt: history.changedAt,
                    reason: history.reason,
                });
            }
        }

        const account = ACCOUNT_MAPPING[category];
        const startDate = filters.startDate;
        const endDate = filters.endDate;

        const rows: AccountingEntryRow[] = loanRows
            .map((row) => {
                const history = latestHistoryByLoan.get(row.loanId);
                const effectiveDate = history?.changedAt ?? row.updatedAt;

                const principalAmount =
                    category === "LOAN_WRITE_OFF"
                        ? toAmount(row.outstandingPrincipal)
                        : toAmount(row.disbursedAmount);

                return {
                    transactionDate: toDisplayDate(effectiveDate),
                    loanNumber: row.loanAccountNumber,
                    customerName: row.borrowerName,
                    transactionType: category,
                    referenceNumber: `${row.loanAccountNumber}-${category}`,
                    debitAccount: account.debitAccount,
                    creditAccount: account.creditAccount,
                    principalAmount,
                    interestAmount: 0,
                    penaltyAmount: 0,
                    fees: 0,
                    taxAmount: 0,
                    totalAmount: principalAmount,
                    remarks: history?.reason ?? row.remarks ?? "",
                    createdAt: toDisplayTimestamp(effectiveDate),
                };
            })
            .filter((row) => {
                if (startDate && row.transactionDate < startDate) {
                    return false;
                }

                if (endDate && row.transactionDate > endDate) {
                    return false;
                }

                return true;
            });

        return buildResult(rows, filters, branchNote(filters));
    }

    async getLoanClosures(filters: AccountingExportFilters): Promise<AccountingExportResult> {
        return this.getStatusDrivenEntries(filters, "LOAN_CLOSURE", "CLOSED");
    }

    async getWriteOffEntries(filters: AccountingExportFilters): Promise<AccountingExportResult> {
        return this.getStatusDrivenEntries(filters, "LOAN_WRITE_OFF", "WRITTEN_OFF");
    }

    /* ---------- Refunds ----------
       No `refunds` table (or equivalent) exists in the schema yet.
       Stubbed to always return an empty, well-formed result rather
       than fabricating data or querying tables that don't model
       refunds. */

    async getRefundEntries(filters: AccountingExportFilters): Promise<AccountingExportResult> {
        logger.warn("Refund entries requested but no refund data source exists in schema", {
            loanId: filters.loanId,
        });

        return buildResult(
            [],
            filters,
            "Refunds are not yet tracked in the schema (no refunds table exists). " +
                "This endpoint is wired for forward compatibility and currently always " +
                "returns an empty result.",
        );
    }

    /* ---------- Format Conversion ---------- */

    exportCSV(rows: AccountingEntryRow[]): string {
        return buildCsv(rows);
    }

    async exportExcel(rows: AccountingEntryRow[], sheetName = "Accounting Entries"): Promise<Buffer> {
        return buildExcelBuffer(rows, sheetName);
    }
}
