import { sendEmail } from "./email.service";
import { sendSMS } from "./sms.service";
import { sendWhatsapp } from "./whatsapp.service";
import { saveNotification } from "../repositories/notification.repository";
import { logger } from "../../../utils/logger";

import type { EmailOptions, EmailResult } from "../types/email.types";
import type { SMSResult } from "../types/sms.types";
import type { WhatsappResult } from "../types/whatsapp.types";
import type {
    NotificationChannel,
    NotificationRecordMeta,
    NotificationStatus,
} from "../types/notification.types";

/**
 * Single entry point for the rest of the application to dispatch notifications.
 * Consuming modules (auth, loans, collections, scheduler, reports, ...) should
 * only ever import `notificationService` — never the individual channel
 * services directly — so the channel implementation can change without touching
 * call sites.
 *
 * Every dispatch is recorded in the `notifications` table, whether it succeeds
 * or fails, so delivery history is always queryable from the db. Only
 * `meta.message` is persisted — never the rendered body, which may contain
 * single-use tokens or reset links.
 */
class NotificationService {
    /**
     * Writing the audit row must never change the outcome of the dispatch: a
     * successful send stays successful if the insert fails, and a failed send
     * still surfaces its ORIGINAL error rather than a database error raised
     * while recording it.
     */
    private async record(
        channel: NotificationChannel,
        meta: NotificationRecordMeta,
        status: NotificationStatus,
    ): Promise<void> {
        try {
            await saveNotification({ ...meta, channel, status });
        } catch (error) {
            logger.error("Failed to persist notification record", {
                channel,
                status,
                userId: meta.userId,
                err: error,
            });
        }
    }

    private async dispatch<T>(
        channel: NotificationChannel,
        meta: NotificationRecordMeta,
        run: () => Promise<T>,
    ): Promise<T> {
        try {
            const result = await run();
            await this.record(channel, meta, "SUCCESS");
            return result;
        } catch (error) {
            await this.record(channel, meta, "FAILED");
            throw error;
        }
    }

    sendEmail(options: EmailOptions, meta: NotificationRecordMeta): Promise<EmailResult> {
        return this.dispatch("EMAIL", meta, () => sendEmail(options));
    }

    sendSMS(phoneNumber: string, message: string, meta: NotificationRecordMeta): Promise<SMSResult> {
        return this.dispatch("SMS", meta, () => sendSMS(phoneNumber, message));
    }

    sendWhatsapp(
        phoneNumber: string,
        message: string,
        meta: NotificationRecordMeta,
    ): Promise<WhatsappResult> {
        return this.dispatch("WHATSAPP", meta, () => sendWhatsapp(phoneNumber, message));
    }
}

export const notificationService = new NotificationService();
