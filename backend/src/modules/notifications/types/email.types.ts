export interface EmailAttachment {
    /** Name reported to the recipient for the attached file. */
    filename?: string;
    /** Raw contents of the attachment. */
    content?: string | Buffer;
    /** Path or URL to stream the attachment from, as an alternative to `content`. */
    path?: string;
    /** MIME type of the attachment; derived from `filename` when omitted. */
    contentType?: string;
}

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: EmailAttachment[];
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
}

export interface EmailResult {
    success: boolean;
    messageId: string;
    /** Recipient addresses the mail server accepted. */
    accepted: string[];
    /** Recipient addresses the mail server rejected. */
    rejected: string[];
}
