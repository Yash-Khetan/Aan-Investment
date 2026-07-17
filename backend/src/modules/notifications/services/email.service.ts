import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../../../config";
import { logger } from "../../../utils/logger";
import type { EmailOptions, EmailResult } from "../types/email.types";
import { EmailDeliveryError, ProviderConfigError } from "../utils/errors";
import { assertValidEmailRecipients, assertSafeHeaderValue } from "../utils/validators";

/**
 * Singleton SMTP transporter. Created lazily on first use and reused for every
 * subsequent call so the connection pool is only set up once per process.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporter) {
        return transporter;
    }

    const { host, port, secure, user, pass } = config.notifications.email;

    if (!host || port === null || !user || !pass) {
        throw new ProviderConfigError(
            "Email service is not configured. Missing one or more required environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
        );
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });

    return transporter;
}

/**
 * Sends an email via the shared SMTP transporter.
 *
 * @throws {InvalidRecipientError} if `to`, `cc`, or `bcc` contain an invalid address.
 * @throws {InvalidNotificationContentError} if `subject`/`replyTo` are unsafe as headers.
 * @throws {EmailDeliveryError} if neither `html` nor `text` is provided, or the send fails.
 * @throws {ProviderConfigError} if required SMTP environment variables are missing.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text, attachments, cc, bcc, replyTo } = options;

    assertValidEmailRecipients(to);
    if (cc) assertValidEmailRecipients(cc);
    if (bcc) assertValidEmailRecipients(bcc);
    assertSafeHeaderValue(subject, "subject");
    if (replyTo) {
        assertValidEmailRecipients(replyTo);
        assertSafeHeaderValue(replyTo, "replyTo");
    }

    if (!html && !text) {
        throw new EmailDeliveryError("Email must include either an `html` or `text` body.");
    }

    const from = config.notifications.email.from;
    if (!from) {
        throw new ProviderConfigError(
            "Email service is not configured. Missing required environment variable: SMTP_FROM.",
        );
    }

    const recipientCount = Array.isArray(to) ? to.length : 1;

    try {
        const client = getTransporter();

        const info = await client.sendMail({
            from,
            to,
            subject,
            html,
            text,
            attachments,
            cc,
            bcc,
            replyTo,
        });

        logger.info("Notification dispatched", {
            channel: "EMAIL",
            status: "SUCCESS",
            recipientCount,
            messageId: info.messageId,
        });

        return {
            success: true,
            messageId: info.messageId,
            accepted: (info.accepted ?? []).map(String),
            rejected: (info.rejected ?? []).map(String),
        };
    } catch (error) {
        if (error instanceof ProviderConfigError) {
            throw error;
        }

        logger.error("Notification failed", { channel: "EMAIL", status: "FAILED", err: error });

        // The provider's own message can carry the SMTP username and the raw
        // server banner. Keep it on `cause` (server-side only); never build it
        // into a message that an error handler might surface to a client.
        throw new EmailDeliveryError("Failed to send email.", error);
    }
}
