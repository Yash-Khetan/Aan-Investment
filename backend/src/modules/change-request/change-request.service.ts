import { BadRequestError, ConflictError, NotFoundError } from "../../common/errors";
import { recordAudit } from "../audit/audit.service";
import * as repository from "./change-request.repository";
import type {
    ChangeRequestAction,
    ChangeRequestApplier,
    ChangeRequestEntityType,
    ChangeRequestRow,
    ListChangeRequestsFilters,
    RequestActor,
    SubmitChangeRequestInput,
} from "./change-request.types";

/**
 * Change-request orchestration: submit, approve, reject, and the bulk/`all`
 * variants the admin "Approvals" page needs.
 *
 * This module never imports Loan/Collateral/Ledger/etc. directly — that
 * would wire a dependency back from a generic workflow module onto every
 * domain module it serves. Instead, each domain module registers its own
 * applier here (see `registerApplier`) at load time, the mirror image of
 * how it already calls `submitChangeRequest` to file one.
 */

interface ApplierEntry {
    fn: ChangeRequestApplier;
    /**
     * Some appliers (ledger entry update/delete, KPI-ledger import post/
     * remove) already call `recordAudit` themselves, with richer context
     * than this module has. Set true to skip the generic post-approval
     * audit call for those, instead of double-logging the same action.
     */
    selfAudits: boolean;
}

const appliers = new Map<string, ApplierEntry>();

const applierKey = (entityType: ChangeRequestEntityType, action: ChangeRequestAction): string =>
    `${entityType}:${action}`;

/** Called once, at module load time, by whichever module owns this (entityType, action). */
export function registerApplier(
    entityType: ChangeRequestEntityType,
    action: ChangeRequestAction,
    applier: ChangeRequestApplier,
    options?: { selfAudits?: boolean },
): void {
    appliers.set(applierKey(entityType, action), { fn: applier, selfAudits: options?.selfAudits ?? false });
}

function getApplier(entityType: ChangeRequestEntityType, action: ChangeRequestAction): ApplierEntry {
    const entry = appliers.get(applierKey(entityType, action));
    if (!entry) {
        throw new BadRequestError(
            `No applier registered for ${entityType}:${action} — this change request cannot be approved yet.`,
        );
    }
    return entry;
}

export async function submitChangeRequest(input: SubmitChangeRequestInput): Promise<ChangeRequestRow> {
    return repository.insert(input);
}

/** Loads a PENDING row by id, or throws — the shared precondition for approve/reject. */
async function loadPending(id: string): Promise<ChangeRequestRow> {
    const row = await repository.findById(id);
    if (!row) throw new NotFoundError(`Change request '${id}' not found`);
    if (row.status !== "PENDING") {
        throw new ConflictError(`Change request '${id}' has already been ${row.status.toLowerCase()}`);
    }
    return row;
}

export async function approveChangeRequest(
    id: string,
    approver: RequestActor,
    notes?: string,
): Promise<ChangeRequestRow> {
    const row = await loadPending(id);
    const { fn: applier, selfAudits } = getApplier(
        row.entityType as ChangeRequestEntityType,
        row.action as ChangeRequestAction,
    );

    const result = (await applier(row.payload, row.entityId)) as { id?: string } | undefined;

    let entityId: string;
    if (row.action === "CREATE") {
        if (result?.id) {
            entityId = result.id;
            await repository.setEntityId(row.id, entityId);
        } else if (row.loanId) {
            // A bulk create (e.g. posting a whole KPI-ledger import) has no
            // single new record to point at — fall back to the loan it
            // affected so the audit entry still has somewhere to land.
            entityId = row.loanId;
        } else {
            throw new BadRequestError(
                `Applier for ${row.entityType}:CREATE did not return a new record id, and this request has no loanId to fall back on.`,
            );
        }
    } else {
        if (!row.entityId) {
            throw new ConflictError(`Change request '${row.id}' has no entityId recorded for a ${row.action} action.`);
        }
        entityId = row.entityId;
    }

    if (!selfAudits) {
        await recordAudit({
            actor: { userId: row.requestedBy },
            action: row.action === "CREATE" ? "CREATE" : row.action === "DELETE" ? "DELETE" : "UPDATE",
            entityType: row.entityType,
            entityId,
            oldValues: row.action === "CREATE" ? undefined : row.previousValues,
            newValues: row.action === "DELETE" ? undefined : row.payload,
        });
    }

    const updated = await repository.markReviewed(id, {
        status: "APPROVED",
        reviewedBy: approver.userId,
        reviewNotes: notes,
    });

    return updated!;
}

export async function rejectChangeRequest(
    id: string,
    approver: RequestActor,
    notes?: string,
): Promise<ChangeRequestRow> {
    await loadPending(id);

    const updated = await repository.markReviewed(id, {
        status: "REJECTED",
        reviewedBy: approver.userId,
        reviewNotes: notes,
    });

    return updated!;
}

export interface BulkResult {
    id: string;
    success: boolean;
    error?: string;
}

export async function bulkApprove(ids: string[], approver: RequestActor, notes?: string): Promise<BulkResult[]> {
    const results: BulkResult[] = [];
    for (const id of ids) {
        try {
            await approveChangeRequest(id, approver, notes);
            results.push({ id, success: true });
        } catch (err) {
            results.push({ id, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
    }
    return results;
}

export async function bulkReject(ids: string[], approver: RequestActor, notes?: string): Promise<BulkResult[]> {
    const results: BulkResult[] = [];
    for (const id of ids) {
        try {
            await rejectChangeRequest(id, approver, notes);
            results.push({ id, success: true });
        } catch (err) {
            results.push({ id, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
    }
    return results;
}

export async function approveAll(
    filters: Pick<ListChangeRequestsFilters, "entityType" | "loanId">,
    approver: RequestActor,
    notes?: string,
): Promise<BulkResult[]> {
    const ids = await repository.listPendingIds(filters);
    return bulkApprove(ids, approver, notes);
}

export async function rejectAll(
    filters: Pick<ListChangeRequestsFilters, "entityType" | "loanId">,
    approver: RequestActor,
    notes?: string,
): Promise<BulkResult[]> {
    const ids = await repository.listPendingIds(filters);
    return bulkReject(ids, approver, notes);
}

export async function listPendingForAdmin(filters: ListChangeRequestsFilters): Promise<ChangeRequestRow[]> {
    return repository.list({ ...filters, status: filters.status ?? "PENDING" });
}

export async function listMine(userId: string, filters: ListChangeRequestsFilters): Promise<ChangeRequestRow[]> {
    return repository.list({ ...filters, requestedBy: userId });
}

export async function listPendingLoanIds(): Promise<string[]> {
    return repository.listPendingLoanIds();
}
