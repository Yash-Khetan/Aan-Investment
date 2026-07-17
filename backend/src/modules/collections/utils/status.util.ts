import type { CollectionStatus } from "../types/collections.types";

export function isOpenStatus(status: CollectionStatus | null | undefined): boolean {
    return status === "OPEN";
}

export function isClosedStatus(status: CollectionStatus | null | undefined): boolean {
    return status === "CLOSED";
}

export function isPromiseToPayStatus(status: CollectionStatus | null | undefined): boolean {
    return status === "PROMISE_TO_PAY";
}

/** Status a case moves to once a Promise to Pay is resolved: CLOSED when kept, FOLLOW_UP when broken. */
export function deriveStatusAfterPromiseClose(kept: boolean): CollectionStatus {
    return kept ? "CLOSED" : "FOLLOW_UP";
}
