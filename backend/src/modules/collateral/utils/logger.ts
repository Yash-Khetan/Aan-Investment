/**
 * Minimal structured logger for the collateral module.
 *
 * Only ever logs the action, a collateral/loan identifier, and outcome.
 * Never pass raw request bodies or full row objects here — only
 * primitive, already-sanitized values (e.g. ids, `error.message`).
 */

export type CollateralAction =
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "GET"
    | "LIST"
    | "VALUATION_UPDATE"
    | "INSURANCE_UPDATE"
    | "LTV_CALCULATED";

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unknown error";
}

export const collateralLogger = {
    success(action: CollateralAction, context: string): void {
        console.log(`[Collateral] action=${action} context=${context} status=SUCCESS`);
    },

    failure(action: CollateralAction, context: string, error: unknown): void {
        console.error(
            `[Collateral] action=${action} context=${context} status=FAILURE reason="${extractErrorMessage(error)}"`
        );
    },
};
