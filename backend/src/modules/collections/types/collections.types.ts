import { collectionStatusEnum } from "../../../db/schema";
import type { ActivityType } from "../constants/collections.constants";

/**
 * Sourced directly from the `collection_status` Postgres enum so this can
 * never drift out of sync with the schema: OPEN | PROMISE_TO_PAY | FOLLOW_UP | CLOSED.
 */
export type CollectionStatus = (typeof collectionStatusEnum.enumValues)[number];

export type { ActivityType };

export interface CreateActivityInput {
    loanId: string;
    borrowerId?: string;
    activityType: ActivityType;
    status?: CollectionStatus;

    followUpDate?: string;
    contactPerson?: string;
    remarks?: string;
    notes?: string;

    assignedTo?: string;
    followUpBy?: string;

    promiseDate?: string;
    promiseAmount?: number | string;
}

export interface UpdateActivityInput {
    activityType?: ActivityType;
    followUpDate?: string;
    contactPerson?: string;
    remarks?: string;
    notes?: string;

    assignedTo?: string;
    followUpBy?: string;

    promiseDate?: string;
    promiseAmount?: number | string;
    promiseKept?: boolean;
}

export interface UpdateStatusInput {
    status: CollectionStatus;
}

export interface UpdateFollowUpInput {
    followUpDate: string;
}

export interface CreatePromiseToPayInput {
    promiseDate: string;
    promiseAmount: number | string;
}

export interface ClosePromiseToPayInput {
    kept: boolean;
    remarks?: string;
}

export interface CollectionActivityRecord {
    id: string;
    loanId: string;
    borrowerId: string;

    status: CollectionStatus | null;
    assignedTo: string | null;

    activityType: string;
    followUpDate: string | null;
    contactPerson: string | null;
    remarks: string | null;
    followUpBy: string | null;

    promiseDate: string | null;
    promiseAmount: string | null;
    promiseKept: boolean | null;

    createdAt: Date | null;
    updatedAt: Date | null;
}
