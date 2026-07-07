/**
 * Custom error hierarchy for the notifications module.
 * Consumers can catch `NotificationError` to handle any notification
 * failure generically, or catch a specific subclass to react to a
 * particular failure mode (bad recipient, missing config, provider error).
 */

export class NotificationError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "NotificationError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Thrown when a recipient email address or phone number fails validation. */
export class InvalidRecipientError extends NotificationError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidRecipientError";
    }
}

/** Thrown when the payload of a notification (e.g. an empty message body) fails validation. */
export class InvalidNotificationContentError extends NotificationError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidNotificationContentError";
    }
}

/** Thrown when a required environment variable for a provider is missing. */
export class ProviderConfigError extends NotificationError {
    constructor(message: string) {
        super(message);
        this.name = "ProviderConfigError";
    }
}

/** Thrown when Nodemailer fails to send an email (auth failure, network error, rejected recipients, etc). */
export class EmailDeliveryError extends NotificationError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "EmailDeliveryError";
    }
}

/** Thrown when Twilio fails to send an SMS message. */
export class SMSDeliveryError extends NotificationError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "SMSDeliveryError";
    }
}

/** Thrown when Twilio fails to send a WhatsApp message. */
export class WhatsappDeliveryError extends NotificationError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "WhatsappDeliveryError";
    }
}
