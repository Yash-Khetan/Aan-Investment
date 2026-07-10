import { and, eq, inArray, isNull, desc } from "drizzle-orm";
import { db } from "../../../db";
import { collectionCases, followUps, loans, borrowers } from "../../../db/schema";

import {
    assertValidUuid,
    assertValidCreateInput,
    assertValidUpdateInput,
    assertValidUpdateStatusInput,
    assertValidUpdateFollowUpInput,
    assertValidCreatePromiseToPayInput,
    assertValidClosePromiseToPayInput,
} from "../validators/collections.validators";

import { formatDate } from "../utils/date.util";
import { deriveStatusAfterPromiseClose } from "../utils/status.util";
import { collectionsLogger } from "../utils/logger";
import {
    CollectionActivityNotFoundError,
    LoanNotFoundError,
    CustomerNotFoundError,
    ValidationError,
    InvalidPromiseToPayStateError,
    CollectionsPersistenceError,
} from "../utils/errors";
import { DEFAULT_COLLECTION_STATUS } from "../constants/collections.constants";

import type {
    CreateActivityInput,
    UpdateActivityInput,
    UpdateStatusInput,
    UpdateFollowUpInput,
    CreatePromiseToPayInput,
    ClosePromiseToPayInput,
    CollectionActivityRecord,
} from "../types/collections.types";

type FollowUpRow = typeof followUps.$inferSelect;
type CaseRow = typeof collectionCases.$inferSelect;
type LoanRow = typeof loans.$inferSelect;
type BorrowerRow = typeof borrowers.$inferSelect;

function toActivityRecord(followUp: FollowUpRow, collectionCase: CaseRow): CollectionActivityRecord {
    return {
        id: followUp.id,
        loanId: collectionCase.loanId,
        borrowerId: collectionCase.borrowerId,

        status: collectionCase.status,
        assignedTo: collectionCase.assignedTo,

        activityType: followUp.followUpType,
        followUpDate: followUp.followUpDate,
        contactPerson: followUp.contactPerson,
        remarks: followUp.remarks,
        followUpBy: followUp.followUpBy,

        promiseDate: followUp.promiseDate,
        promiseAmount: followUp.promiseAmount,
        promiseKept: followUp.promiseKept,

        createdAt: followUp.createdAt,
        updatedAt: followUp.updatedAt,
    };
}

/**
 * Generic collections/recovery management service. Consuming modules
 * should only ever go through this class — never touch the
 * `collection_cases` / `follow_ups` tables directly — so callers stay
 * decoupled from schema and validation details.
 *
 * Every loan is backed by at most one active `collection_cases` row,
 * created automatically the first time an activity is logged against it.
 * Each logged activity is a row in `follow_ups`, which is what this
 * service exposes publicly as a "collection activity" — the case itself
 * is an internal aggregate that carries the loan's current status,
 * assignee, and next follow-up date.
 */
export class CollectionsService {
    static async createActivity(input: CreateActivityInput): Promise<CollectionActivityRecord> {
        assertValidCreateInput(input);

        const loan = await this.getActiveLoanRowOrThrow(input.loanId);

        if (input.borrowerId !== undefined && input.borrowerId !== loan.borrowerId) {
            throw new ValidationError(
                `borrowerId "${input.borrowerId}" does not match loan "${input.loanId}"'s borrower.`
            );
        }

        const remarks = input.remarks ?? input.notes;
        const followUpDate = input.followUpDate ?? formatDate(new Date())!;

        try {
            const record = await db.transaction(async (tx) => {
                let collectionCase = await this.getActiveCaseByLoanId(input.loanId, tx);

                if (!collectionCase) {
                    [collectionCase] = await tx
                        .insert(collectionCases)
                        .values({
                            loanId: input.loanId,
                            borrowerId: loan.borrowerId,
                            status: input.status ?? DEFAULT_COLLECTION_STATUS,
                            assignedTo: input.assignedTo,
                            nextFollowUpDate: followUpDate,
                        })
                        .returning();
                } else if (input.status !== undefined || input.assignedTo !== undefined) {
                    [collectionCase] = await tx
                        .update(collectionCases)
                        .set({
                            status: input.status,
                            assignedTo: input.assignedTo,
                            nextFollowUpDate: followUpDate,
                            updatedAt: new Date(),
                        })
                        .where(eq(collectionCases.id, collectionCase.id))
                        .returning();
                }

                const [followUp] = await tx
                    .insert(followUps)
                    .values({
                        collectionCaseId: collectionCase.id,
                        followUpDate,
                        followUpType: input.activityType,
                        contactPerson: input.contactPerson,
                        remarks,
                        followUpBy: input.followUpBy,
                        promiseDate: input.promiseDate,
                        promiseAmount: input.promiseAmount !== undefined ? String(input.promiseAmount) : undefined,
                    })
                    .returning();

                return toActivityRecord(followUp, collectionCase);
            });

            collectionsLogger.success("CREATE", record.id);
            return record;
        } catch (error) {
            collectionsLogger.failure("CREATE", input.loanId, error);
            throw new CollectionsPersistenceError(
                `Failed to create collection activity: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async updateActivity(id: string, input: UpdateActivityInput): Promise<CollectionActivityRecord> {
        assertValidUuid(id, "id");
        assertValidUpdateInput(input);
        const { collectionCase: existingCase } = await this.getActiveFollowUpWithCaseOrThrow(id);

        const remarks = input.remarks ?? input.notes;

        try {
            const record = await db.transaction(async (tx) => {
                const [followUp] = await tx
                    .update(followUps)
                    .set({
                        followUpType: input.activityType,
                        followUpDate: input.followUpDate,
                        contactPerson: input.contactPerson,
                        remarks,
                        followUpBy: input.followUpBy,
                        promiseDate: input.promiseDate,
                        promiseAmount: input.promiseAmount !== undefined ? String(input.promiseAmount) : undefined,
                        promiseKept: input.promiseKept,
                        updatedAt: new Date(),
                    })
                    .where(eq(followUps.id, id))
                    .returning();

                let collectionCase = existingCase;
                if (input.assignedTo !== undefined) {
                    [collectionCase] = await tx
                        .update(collectionCases)
                        .set({ assignedTo: input.assignedTo, updatedAt: new Date() })
                        .where(eq(collectionCases.id, existingCase.id))
                        .returning();
                }

                return toActivityRecord(followUp, collectionCase);
            });

            collectionsLogger.success("UPDATE", id);
            return record;
        } catch (error) {
            collectionsLogger.failure("UPDATE", id, error);
            throw new CollectionsPersistenceError(
                `Failed to update collection activity: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async deleteActivity(id: string): Promise<void> {
        assertValidUuid(id, "id");
        await this.getActiveFollowUpWithCaseOrThrow(id);

        try {
            await db
                .update(followUps)
                .set({ deletedAt: new Date(), updatedAt: new Date() })
                .where(eq(followUps.id, id));

            collectionsLogger.success("DELETE", id);
        } catch (error) {
            collectionsLogger.failure("DELETE", id, error);
            throw new CollectionsPersistenceError(
                `Failed to delete collection activity: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async getActivity(id: string): Promise<CollectionActivityRecord> {
        assertValidUuid(id, "id");
        const { followUp, collectionCase } = await this.getActiveFollowUpWithCaseOrThrow(id);

        collectionsLogger.success("GET", id);
        return toActivityRecord(followUp, collectionCase);
    }

    static async getLoanActivities(loanId: string): Promise<CollectionActivityRecord[]> {
        assertValidUuid(loanId, "loanId");
        await this.getActiveLoanRowOrThrow(loanId);

        const collectionCase = await this.getActiveCaseByLoanId(loanId);
        if (!collectionCase) {
            collectionsLogger.success("LIST_LOAN", loanId);
            return [];
        }

        const rows = await db
            .select()
            .from(followUps)
            .where(and(eq(followUps.collectionCaseId, collectionCase.id), isNull(followUps.deletedAt)))
            .orderBy(desc(followUps.followUpDate), desc(followUps.createdAt));

        collectionsLogger.success("LIST_LOAN", loanId);
        return rows.map((row) => toActivityRecord(row, collectionCase));
    }

    static async getCustomerActivities(borrowerId: string): Promise<CollectionActivityRecord[]> {
        assertValidUuid(borrowerId, "borrowerId");
        await this.getActiveBorrowerRowOrThrow(borrowerId);

        const cases = await db
            .select()
            .from(collectionCases)
            .where(and(eq(collectionCases.borrowerId, borrowerId), isNull(collectionCases.deletedAt)));

        if (cases.length === 0) {
            collectionsLogger.success("LIST_CUSTOMER", borrowerId);
            return [];
        }

        const caseById = new Map(cases.map((c) => [c.id, c]));

        const rows = await db
            .select()
            .from(followUps)
            .where(
                and(
                    inArray(
                        followUps.collectionCaseId,
                        cases.map((c) => c.id)
                    ),
                    isNull(followUps.deletedAt)
                )
            )
            .orderBy(desc(followUps.followUpDate), desc(followUps.createdAt));

        collectionsLogger.success("LIST_CUSTOMER", borrowerId);
        return rows.map((row) => toActivityRecord(row, caseById.get(row.collectionCaseId)!));
    }

    static async updateStatus(id: string, input: UpdateStatusInput): Promise<CollectionActivityRecord> {
        assertValidUuid(id, "id");
        assertValidUpdateStatusInput(input);
        const { followUp, collectionCase } = await this.getActiveFollowUpWithCaseOrThrow(id);

        try {
            const [updatedCase] = await db
                .update(collectionCases)
                .set({ status: input.status, updatedAt: new Date() })
                .where(eq(collectionCases.id, collectionCase.id))
                .returning();

            collectionsLogger.success("STATUS_UPDATE", id);
            return toActivityRecord(followUp, updatedCase);
        } catch (error) {
            collectionsLogger.failure("STATUS_UPDATE", id, error);
            throw new CollectionsPersistenceError(
                `Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async updateFollowUp(id: string, input: UpdateFollowUpInput): Promise<CollectionActivityRecord> {
        assertValidUuid(id, "id");
        assertValidUpdateFollowUpInput(input);
        const { collectionCase } = await this.getActiveFollowUpWithCaseOrThrow(id);

        try {
            const record = await db.transaction(async (tx) => {
                const [followUp] = await tx
                    .update(followUps)
                    .set({ followUpDate: input.followUpDate, updatedAt: new Date() })
                    .where(eq(followUps.id, id))
                    .returning();

                const [updatedCase] = await tx
                    .update(collectionCases)
                    .set({ nextFollowUpDate: input.followUpDate, updatedAt: new Date() })
                    .where(eq(collectionCases.id, collectionCase.id))
                    .returning();

                return toActivityRecord(followUp, updatedCase);
            });

            collectionsLogger.success("FOLLOW_UP_UPDATE", id);
            return record;
        } catch (error) {
            collectionsLogger.failure("FOLLOW_UP_UPDATE", id, error);
            throw new CollectionsPersistenceError(
                `Failed to update follow-up date: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async createPromiseToPay(
        id: string,
        input: CreatePromiseToPayInput
    ): Promise<CollectionActivityRecord> {
        assertValidUuid(id, "id");
        assertValidCreatePromiseToPayInput(input);
        const { collectionCase } = await this.getActiveFollowUpWithCaseOrThrow(id);

        try {
            const record = await db.transaction(async (tx) => {
                const [followUp] = await tx
                    .update(followUps)
                    .set({
                        promiseDate: input.promiseDate,
                        promiseAmount: String(input.promiseAmount),
                        promiseKept: null,
                        updatedAt: new Date(),
                    })
                    .where(eq(followUps.id, id))
                    .returning();

                const [updatedCase] = await tx
                    .update(collectionCases)
                    .set({
                        status: "PROMISE_TO_PAY",
                        nextFollowUpDate: input.promiseDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(collectionCases.id, collectionCase.id))
                    .returning();

                return toActivityRecord(followUp, updatedCase);
            });

            collectionsLogger.success("PROMISE_CREATED", id);
            return record;
        } catch (error) {
            collectionsLogger.failure("PROMISE_CREATED", id, error);
            throw new CollectionsPersistenceError(
                `Failed to create Promise to Pay: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async closePromiseToPay(id: string, input: ClosePromiseToPayInput): Promise<CollectionActivityRecord> {
        assertValidUuid(id, "id");
        assertValidClosePromiseToPayInput(input);
        const { followUp: existing, collectionCase } = await this.getActiveFollowUpWithCaseOrThrow(id);

        if (!existing.promiseDate) {
            throw new InvalidPromiseToPayStateError(`Activity "${id}" has no Promise to Pay to close.`);
        }

        if (existing.promiseKept !== null) {
            throw new InvalidPromiseToPayStateError(`The Promise to Pay on activity "${id}" is already closed.`);
        }

        try {
            const newStatus = deriveStatusAfterPromiseClose(input.kept);

            const record = await db.transaction(async (tx) => {
                const [followUp] = await tx
                    .update(followUps)
                    .set({
                        promiseKept: input.kept,
                        remarks: input.remarks,
                        updatedAt: new Date(),
                    })
                    .where(eq(followUps.id, id))
                    .returning();

                const [updatedCase] = await tx
                    .update(collectionCases)
                    .set({ status: newStatus, updatedAt: new Date() })
                    .where(eq(collectionCases.id, collectionCase.id))
                    .returning();

                return toActivityRecord(followUp, updatedCase);
            });

            collectionsLogger.success("PROMISE_CLOSED", id);
            return record;
        } catch (error) {
            collectionsLogger.failure("PROMISE_CLOSED", id, error);
            throw new CollectionsPersistenceError(
                `Failed to close Promise to Pay: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    private static async getActiveCaseByLoanId(
        loanId: string,
        executor: Pick<typeof db, "select"> = db
    ): Promise<CaseRow | undefined> {
        const [row] = await executor
            .select()
            .from(collectionCases)
            .where(and(eq(collectionCases.loanId, loanId), isNull(collectionCases.deletedAt)))
            .limit(1);

        return row;
    }

    private static async getActiveFollowUpWithCaseOrThrow(
        id: string
    ): Promise<{ followUp: FollowUpRow; collectionCase: CaseRow }> {
        const [row] = await db
            .select({ followUp: followUps, collectionCase: collectionCases })
            .from(followUps)
            .innerJoin(collectionCases, eq(followUps.collectionCaseId, collectionCases.id))
            .where(
                and(
                    eq(followUps.id, id),
                    isNull(followUps.deletedAt),
                    isNull(collectionCases.deletedAt)
                )
            )
            .limit(1);

        if (!row) {
            throw new CollectionActivityNotFoundError(`No collection activity found with id "${id}".`);
        }

        return row;
    }

    private static async getActiveLoanRowOrThrow(loanId: string): Promise<LoanRow> {
        const [row] = await db
            .select()
            .from(loans)
            .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
            .limit(1);

        if (!row) {
            throw new LoanNotFoundError(`No loan found with id "${loanId}".`);
        }

        return row;
    }

    private static async getActiveBorrowerRowOrThrow(borrowerId: string): Promise<BorrowerRow> {
        const [row] = await db
            .select()
            .from(borrowers)
            .where(and(eq(borrowers.id, borrowerId), isNull(borrowers.deletedAt)))
            .limit(1);

        if (!row) {
            throw new CustomerNotFoundError(`No customer found with id "${borrowerId}".`);
        }

        return row;
    }
}
