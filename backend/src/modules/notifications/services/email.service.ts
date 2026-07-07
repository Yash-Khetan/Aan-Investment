import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import dotenv from "dotenv"; 
import type { EmailOptions, EmailResult } from "../types/email.types";
import { EmailDeliveryError, ProviderConfigError } from "../utils/errors";
import { assertValidEmailRecipients } from "../utils/validators";
import { notificationLogger } from "../utils/logger";
dotenv.config(); // Load environment variables from .env file

/**
 * Singleton SMTP transporter. Created lazily on first use and reused
 * for every subsequent call so the connection pool is only set up once
 * per process.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporter) {
        return transporter;
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new ProviderConfigError(
            "Email service is not configured. Missing one or more required environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS."
        );
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === "true",
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    return transporter;
}

function firstRecipient(to: string | string[]): string {
    return Array.isArray(to) ? (to[0] ?? "") : to;
}

/**
 * Sends an email via the shared SMTP transporter.
 *
 * @throws {InvalidRecipientError} if `to`, `cc`, or `bcc` contain an invalid address.
 * @throws {EmailDeliveryError} if neither `html` nor `text` is provided, or the send fails.
 * @throws {ProviderConfigError} if required SMTP environment variables are missing.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text, attachments, cc, bcc, replyTo } = options;

    assertValidEmailRecipients(to);
    if (cc) assertValidEmailRecipients(cc);
    if (bcc) assertValidEmailRecipients(bcc);

    if (!html && !text) {
        throw new EmailDeliveryError("Email must include either an `html` or `text` body.");
    }

    const from = process.env.SMTP_FROM;
    if (!from) {
        throw new ProviderConfigError(
            "Email service is not configured. Missing required environment variable: SMTP_FROM."
        );
    }

    const destination = firstRecipient(to);

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

        notificationLogger.success("EMAIL", destination);

        return {
            success: true,
            messageId: info.messageId,
            accepted: (info.accepted ?? []).map(String),
            rejected: (info.rejected ?? []).map(String),
            response: info.response,
        };
    } catch (error) {
        notificationLogger.failure("EMAIL", destination, error);

        if (error instanceof ProviderConfigError) {
            throw error;
        }

        throw new EmailDeliveryError(
            `Failed to send email to "${destination}": ${error instanceof Error ? error.message : "Unknown error"}`,
            error
        );
    }
}
