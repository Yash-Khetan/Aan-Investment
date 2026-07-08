import { collectionStatusEnum } from "../../../db/schema";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_MAX_LENGTH } from "../constants/collections.constants";
import { isValidDateString } from "../utils/date.util";
import { ValidationError, InvalidActivityTypeError, InvalidStatusError } from "../utils/errors";
import type {
    ActivityType,
    CollectionStatus,
    CreateActivityInput,
    UpdateActivityInput,
    UpdateStatusInput,
    UpdateFollowUpInput,
    CreatePromiseToPayInput,
    ClosePromiseToPayInput,
} from "../types/collections.types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUuid(value: string, fieldName: string): void {
    if (!value || !UUID_REGEX.test(value)) {
        throw new ValidationError(`Invalid ${fieldName} "${value}". Must be a valid UUID.`);
    }
}

export function assertValidActivityType(activityType: string): asserts activityType is ActivityType {
    if (!(ACTIVITY_TYPES as readonly string[]).includes(activityType)) {
        throw new InvalidActivityTypeError(
            `Invalid activityType "${activityType}". Must be one of: ${ACTIVITY_TYPES.join(", ")}.`
        );
    }

    if (activityType.length > ACTIVITY_TYPE_MAX_LENGTH) {
        throw new InvalidActivityTypeError(`activityType must be at most ${ACTIVITY_TYPE_MAX_LENGTH} characters.`);
    }
}

export function assertValidCollectionStatus(status: string): asserts status is CollectionStatus {
    if (!collectionStatusEnum.enumValues.includes(status as CollectionStatus)) {
        throw new InvalidStatusError(
            `Invalid status "${status}". Must be one of: ${collectionStatusEnum.enumValues.join(", ")}.`
        );
    }
}

export function assertNonNegativeAmount(value: number | string, fieldName: string): void {
    const numeric = Number(value);
    if (value === undefined || value === null || value === "" || !Number.isFinite(numeric)) {
        throw new ValidationError(`${fieldName} must be a valid number.`);
    }

    if (numeric < 0) {
        throw new ValidationError(`${fieldName} cannot be negative.`);
    }
}

export function assertValidDate(value: string, fieldName: string): void {
    if (!isValidDateString(value)) {
        throw new ValidationError(`Invalid ${fieldName} "${value}". Must be a valid date.`);
    }
}

/** Validates the required fields for creating a collection activity: loanId, activityType, and any optional fields supplied. */
export function assertValidCreateInput(input: CreateActivityInput): void {
    if (!input.loanId) {
        throw new ValidationError("loanId is required.");
    }
    assertValidUuid(input.loanId, "loanId");

    if (!input.activityType) {
        throw new ValidationError("activityType is required.");
    }
    assertValidActivityType(input.activityType);

    if (input.borrowerId !== undefined) {
        assertValidUuid(input.borrowerId, "borrowerId");
    }

    if (input.status !== undefined) {
        assertValidCollectionStatus(input.status);
    }

    if (input.followUpDate !== undefined) {
        assertValidDate(input.followUpDate, "followUpDate");
    }

    if (input.assignedTo !== undefined) {
        assertValidUuid(input.assignedTo, "assignedTo");
    }

    if (input.followUpBy !== undefined) {
        assertValidUuid(input.followUpBy, "followUpBy");
    }

    if (input.promiseDate !== undefined) {
        assertValidDate(input.promiseDate, "promiseDate");
    }

    if (input.promiseAmount !== undefined) {
        assertNonNegativeAmount(input.promiseAmount, "promiseAmount");
    }
}

/** Validates the optional fields supplied to CollectionsService.updateActivity. */
export function assertValidUpdateInput(input: UpdateActivityInput): void {
    if (input.activityType !== undefined) {
        assertValidActivityType(input.activityType);
    }

    if (input.followUpDate !== undefined) {
        assertValidDate(input.followUpDate, "followUpDate");
    }

    if (input.assignedTo !== undefined) {
        assertValidUuid(input.assignedTo, "assignedTo");
    }

    if (input.followUpBy !== undefined) {
        assertValidUuid(input.followUpBy, "followUpBy");
    }

    if (input.promiseDate !== undefined) {
        assertValidDate(input.promiseDate, "promiseDate");
    }

    if (input.promiseAmount !== undefined) {
        assertNonNegativeAmount(input.promiseAmount, "promiseAmount");
    }
}

export function assertValidUpdateStatusInput(input: UpdateStatusInput): void {
    if (!input.status) {
        throw new ValidationError("status is required.");
    }
    assertValidCollectionStatus(input.status);
}

export function assertValidUpdateFollowUpInput(input: UpdateFollowUpInput): void {
    if (!input.followUpDate) {
        throw new ValidationError("followUpDate is required.");
    }
    assertValidDate(input.followUpDate, "followUpDate");
}

export function assertValidCreatePromiseToPayInput(input: CreatePromiseToPayInput): void {
    if (!input.promiseDate) {
        throw new ValidationError("promiseDate is required.");
    }
    assertValidDate(input.promiseDate, "promiseDate");

    if (input.promiseAmount === undefined || input.promiseAmount === null) {
        throw new ValidationError("promiseAmount is required.");
    }
    assertNonNegativeAmount(input.promiseAmount, "promiseAmount");
}

export function assertValidClosePromiseToPayInput(input: ClosePromiseToPayInput): void {
    if (typeof input.kept !== "boolean") {
        throw new ValidationError("kept is required and must be a boolean.");
    }
}
