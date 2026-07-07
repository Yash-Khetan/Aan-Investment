import { InvalidRecipientError, InvalidNotificationContentError } from "./errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E.164 international phone number format, e.g. +14155552671 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

const WHATSAPP_PREFIX = "whatsapp:";

export function assertValidEmail(email: string): void {
    if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
        throw new InvalidRecipientError(`Invalid email address: "${email}"`);
    }
}

export function assertValidEmailRecipients(recipients: string | string[]): void {
    const list = Array.isArray(recipients) ? recipients : [recipients];

    if (list.length === 0) {
        throw new InvalidRecipientError("At least one recipient email address is required.");
    }

    list.forEach(assertValidEmail);
}

/**
 * Validates a phone number in E.164 format. Accepts an optional
 * `whatsapp:` prefix (used by the WhatsApp service) and validates the
 * underlying number.
 */
export function assertValidPhoneNumber(phoneNumber: string): void {
    const rawNumber = phoneNumber?.startsWith(WHATSAPP_PREFIX)
        ? phoneNumber.slice(WHATSAPP_PREFIX.length)
        : phoneNumber;

    if (typeof rawNumber !== "string" || !E164_PHONE_REGEX.test(rawNumber)) {
        throw new InvalidRecipientError(
            `Invalid phone number: "${phoneNumber}". Phone numbers must be in E.164 format (e.g. +14155552671).`
        );
    }
}

export function assertNonEmptyMessage(message: string, label: string): void {
    if (typeof message !== "string" || message.trim().length === 0) {
        throw new InvalidNotificationContentError(`${label} message body cannot be empty.`);
    }
}
