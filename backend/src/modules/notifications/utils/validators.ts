import { InvalidRecipientError, InvalidNotificationContentError } from "./errors";

/**
 * Deliberately stricter than RFC 5322. Address separators (`,` `;`), angle
 * brackets, quotes, and whitespace are all rejected, because Nodemailer parses
 * an address string as an address LIST — a single `to` of
 * `"user@example.com, attacker@evil.com"` would silently fan the mail out to
 * both. Rejecting the separators is what makes a stored address safe to hand
 * to Nodemailer unescaped.
 */
const EMAIL_REGEX = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\]+\.[A-Za-z]{2,}$/;

/** E.164 international phone number format, e.g. +14155552671 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/** A CR or LF inside a header value lets a caller inject additional SMTP headers. */
const HEADER_INJECTION_REGEX = /[\r\n]/;

/**
 * Error messages never echo the offending value back: the recipient is
 * attacker-influenced in some flows, and the message can reach a log or an
 * HTTP response.
 */
function assertValidEmail(email: string): void {
    if (typeof email !== "string" || email.length > 254 || !EMAIL_REGEX.test(email)) {
        throw new InvalidRecipientError("Invalid email address.");
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
 * Guards a value that becomes an email header (subject, replyTo). A newline
 * here would terminate the header, letting the remainder of the string be
 * interpreted as further headers or as the message body.
 */
export function assertSafeHeaderValue(value: string, label: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new InvalidNotificationContentError(`Email ${label} cannot be empty.`);
    }
    if (HEADER_INJECTION_REGEX.test(value)) {
        throw new InvalidNotificationContentError(
            `Email ${label} must not contain line breaks.`,
        );
    }
}

/** Validates a phone number in E.164 format. Callers pass a bare number, never a `whatsapp:` address. */
export function assertValidPhoneNumber(phoneNumber: string): void {
    if (typeof phoneNumber !== "string" || !E164_PHONE_REGEX.test(phoneNumber)) {
        throw new InvalidRecipientError(
            "Invalid phone number. Phone numbers must be in E.164 format (e.g. +14155552671).",
        );
    }
}

export function assertNonEmptyMessage(message: string, label: string): void {
    if (typeof message !== "string" || message.trim().length === 0) {
        throw new InvalidNotificationContentError(`${label} message body cannot be empty.`);
    }
}
