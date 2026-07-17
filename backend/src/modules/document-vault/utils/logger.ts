/**
 * Minimal structured logger for the document-vault module.
 *
 * Only ever logs the action, a document/entity identifier, and outcome.
 * Never pass raw file contents, storage credentials, or provider error
 * objects here — only primitive, already-sanitized values (e.g. `error.message`).
 */

export type DocumentAction = "UPLOAD" | "DOWNLOAD" | "DELETE" | "LIST" | "SIGNED_URL";

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unknown error";
}

export const documentLogger = {
    success(action: DocumentAction, context: string): void {
        console.log(`[DocumentVault] action=${action} context=${context} status=SUCCESS`);
    },

    failure(action: DocumentAction, context: string, error: unknown): void {
        console.error(
            `[DocumentVault] action=${action} context=${context} status=FAILURE reason="${extractErrorMessage(error)}"`
        );
    },
};
