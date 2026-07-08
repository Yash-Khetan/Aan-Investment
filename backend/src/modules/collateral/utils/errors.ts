/**
 * Custom error hierarchy for the collateral module.
 * Consumers can catch `CollateralError` to handle any module failure
 * generically, or catch a specific subclass to react to a particular
 * failure mode (validation, not-found, persistence).
 */

export class CollateralError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "CollateralError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Thrown when a requested collateral id doesn't resolve to an active row. */
export class CollateralNotFoundError extends CollateralError {
    constructor(message: string) {
        super(message);
        this.name = "CollateralNotFoundError";
    }
}

/** Thrown when `loanId` doesn't resolve to an existing loan. */
export class LoanNotFoundError extends CollateralError {
    constructor(message: string) {
        super(message);
        this.name = "LoanNotFoundError";
    }
}

/** Thrown when `securityType` isn't a value of the `security_type` enum. */
export class InvalidCollateralTypeError extends CollateralError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidCollateralTypeError";
    }
}

/** Thrown when a required field is missing or a supplied value fails validation. */
export class ValidationError extends CollateralError {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/** Thrown when a collateral that appears to already exist for the loan is submitted again. */
export class DuplicateCollateralError extends CollateralError {
    constructor(message: string) {
        super(message);
        this.name = "DuplicateCollateralError";
    }
}

/** Thrown when LTV cannot be computed (e.g. zero/missing market value). */
export class LtvCalculationError extends CollateralError {
    constructor(message: string) {
        super(message);
        this.name = "LtvCalculationError";
    }
}

/** Thrown when a database read/write against collateral tables fails. */
export class CollateralPersistenceError extends CollateralError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "CollateralPersistenceError";
    }
}
