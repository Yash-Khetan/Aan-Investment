import { sendEmail } from "./email.service";
import { sendSMS } from "./sms.service";
import { sendWhatsapp } from "./whatsapp.service";
import { saveNotification } from "../repositories/notification.repository";

import type { EmailOptions, EmailResult } from "../types/email.types";
import type { SMSResult } from "../types/sms.types";
import type { WhatsappResult } from "../types/whatsapp.types";
import type { NotificationChannel } from "../utils/logger";

/** Identifies who a notification is for and how it should appear in their notification list. */
export interface NotificationRecordMeta {
    userId: string;
    title: string;
    link?: string;
}

/**
 * Single entry point for the rest of the application to dispatch
 * notifications. Consuming modules (auth, loans, collections,
 * scheduler, reports, ...) should only ever import `NotificationService`
 * — never the individual channel services directly — so the channel
 * implementation can change without touching call sites.
 *
 * Every dispatch is recorded in the `notifications` table, whether it
 * succeeds or fails, so delivery history is always queryable from the db.
 */
class NotificationService {
    private async dispatch<T>(
        channel: NotificationChannel,
        meta: NotificationRecordMeta,
        message: string | undefined,
        run: () => Promise<T>
    ): Promise<T> {
        try {
            const result = await run();
            await saveNotification({ ...meta, message, channel, status: "SUCCESS" });
            return result;
        } catch (error) {
            await saveNotification({ ...meta, message, channel, status: "FAILED" });
            throw error;
        }
    }

    sendEmail(options: EmailOptions, meta: NotificationRecordMeta): Promise<EmailResult> {
        return this.dispatch("EMAIL", meta, options.text ?? options.html, () => sendEmail(options));
    }

    sendSMS(phoneNumber: string, message: string, meta: NotificationRecordMeta): Promise<SMSResult> {
        return this.dispatch("SMS", meta, message, () => sendSMS(phoneNumber, message));
    }

    sendWhatsapp(phoneNumber: string, message: string, meta: NotificationRecordMeta): Promise<WhatsappResult> {
        return this.dispatch("WHATSAPP", meta, message, () => sendWhatsapp(phoneNumber, message));
    }
}

export const notificationService = new NotificationService();
