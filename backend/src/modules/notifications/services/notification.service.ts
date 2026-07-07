import { sendEmail } from "./email.service";
import { sendSMS } from "./sms.service";
import { sendWhatsapp } from "./whatsapp.service";

import type { EmailOptions, EmailResult } from "../types/email.types";
import type { SMSResult } from "../types/sms.types";
import type { WhatsappResult } from "../types/whatsapp.types";

/**
 * Single entry point for the rest of the application to dispatch
 * notifications. Consuming modules (auth, loans, collections,
 * scheduler, reports, ...) should only ever import `NotificationService`
 * — never the individual channel services directly — so the channel
 * implementation can change without touching call sites.
 */
class NotificationService {
    sendEmail(options: EmailOptions): Promise<EmailResult> {
        return sendEmail(options);
    }

    sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
        return sendSMS(phoneNumber, message);
    }

    sendWhatsapp(phoneNumber: string, message: string): Promise<WhatsappResult> {
        return sendWhatsapp(phoneNumber, message);
    }
}

export const notificationService = new NotificationService();
