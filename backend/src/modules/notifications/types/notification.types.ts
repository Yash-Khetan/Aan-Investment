/** Delivery channels supported by the notifications module. Mirrors the `reminder_channel` DB enum. */
export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";

/** Outcome recorded for every dispatch. Mirrors the `notification_status` DB enum. */
export type NotificationStatus = "SUCCESS" | "FAILED";

/**
 * Identifies who a notification is for and how it should appear in their
 * notification list.
 *
 * `message` is what gets PERSISTED to the notifications table — it is not the
 * delivered body. Callers must pass a summary safe to store at rest; never the
 * rendered body, which may contain single-use tokens or reset links.
 */
export interface NotificationRecordMeta {
    userId: string;
    title: string;
    message?: string;
    link?: string;
}
