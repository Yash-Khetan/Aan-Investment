/**
 * Minimal structured logger for the collections module.
 *
 * Only ever logs the action, an activity/loan/customer identifier, and
 * outcome. Never pass raw request bodies or full row objects here — only
 * primitive, already-sanitized values (e.g. ids, `error.message`).
 */

export type CollectionsAction =
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "GET"
    | "LIST_LOAN"
    | "LIST_CUSTOMER"
    | "STATUS_UPDATE"
    | "FOLLOW_UP_UPDATE"
    | "PROMISE_CREATED"
    | "PROMISE_CLOSED";

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unknown error";
}

export const collectionsLogger = {
    success(action: CollectionsAction, context: string): void {
        console.log(`[Collections] action=${action} context=${context} status=SUCCESS`);
    },

    failure(action: CollectionsAction, context: string, error: unknown): void {
        console.error(
            `[Collections] action=${action} context=${context} status=FAILURE reason="${extractErrorMessage(error)}"`
        );
    },
};
