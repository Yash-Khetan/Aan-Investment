/**
 * Minimal structured logger for the notifications module.
 *
 * Only ever logs the notification channel, destination, and outcome.
 * Never pass raw config, credentials, or provider error objects here —
 * only primitive, already-sanitized values (e.g. `error.message`).
 */

export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unknown error";
}

export const notificationLogger = {
    success(channel: NotificationChannel, destination: string): void {
        console.log(
            `[Notification] channel=${channel} destination=${destination} status=SUCCESS`
        );
    },

    failure(channel: NotificationChannel, destination: string, error: unknown): void {
        console.error(
            `[Notification] channel=${channel} destination=${destination} status=FAILURE reason="${extractErrorMessage(error)}"`
        );
    },
};
