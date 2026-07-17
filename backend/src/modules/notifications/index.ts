/**
 * Public surface of the notifications module. Other parts of the
 * application (auth, loans, collections, scheduler, reports, ...)
 * should import only from this file.
 */

export { notificationService } from "./services/notification.service";

export { renderEmailLayout, emailButton } from "./templates/email-layout";
export type { EmailLayoutOptions } from "./templates/email-layout";

export type {
    NotificationChannel,
    NotificationRecordMeta,
    NotificationStatus,
} from "./types/notification.types";

export type { EmailOptions, EmailAttachment, EmailResult } from "./types/email.types";
export type { SMSResult } from "./types/sms.types";
export type { WhatsappResult } from "./types/whatsapp.types";

export {
    NotificationError,
    InvalidRecipientError,
    InvalidNotificationContentError,
    ProviderConfigError,
    EmailDeliveryError,
    SMSDeliveryError,
    WhatsappDeliveryError,
} from "./utils/errors";
