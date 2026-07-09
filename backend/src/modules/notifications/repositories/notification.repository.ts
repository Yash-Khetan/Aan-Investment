import { db } from "../../../db";
import { notifications } from "../../../db/schema";
import type { NotificationChannel, NotificationStatus } from "../types/notification.types";

export interface SaveNotificationInput {
    userId: string;
    title: string;
    /** Summary safe to store at rest — never the rendered body. */
    message?: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    link?: string;
}

/** Persists a record of a dispatched notification (email, SMS, or WhatsApp) to the `notifications` table. */
export async function saveNotification(input: SaveNotificationInput): Promise<void> {
    await db.insert(notifications).values({
        userId: input.userId,
        title: input.title,
        message: input.message,
        channel: input.channel,
        status: input.status,
        link: input.link,
    });
}
