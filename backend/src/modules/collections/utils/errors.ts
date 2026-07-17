/**
 * Custom error hierarchy for the collections module.
 * Consumers can catch `CollectionsError` to handle any module failure
 * generically, or catch a specific subclass to react to a particular
 * failure mode (validation, not-found, persistence).
 */

export class CollectionsError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "CollectionsError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Thrown when a requested collection activity id doesn't resolve to an active row. */
export class CollectionActivityNotFoundError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "CollectionActivityNotFoundError";
    }
}

/** Thrown when `loanId` doesn't resolve to an existing loan. */
export class LoanNotFoundError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "LoanNotFoundError";
    }
}

/** Thrown when `borrowerId` (the customer) doesn't resolve to an existing borrower. */
export class CustomerNotFoundError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "CustomerNotFoundError";
    }
}

/** Thrown when a required field is missing or a supplied value fails validation. */
export class ValidationError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/** Thrown when `activityType` isn't one of the module's supported activity kinds. */
export class InvalidActivityTypeError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidActivityTypeError";
    }
}

/** Thrown when `status` isn't a value of the `collection_status` enum. */
export class InvalidStatusError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidStatusError";
    }
}

/** Thrown when closing a Promise to Pay that was never created for the activity, or was already closed. */
export class InvalidPromiseToPayStateError extends CollectionsError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidPromiseToPayStateError";
    }
}

/** Thrown when a database read/write against collections tables fails. */
export class CollectionsPersistenceError extends CollectionsError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "CollectionsPersistenceError";
    }
}
