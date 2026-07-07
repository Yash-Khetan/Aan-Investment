export interface WhatsappResult {
    success: boolean;
    /** Twilio message SID. */
    sid: string;
    /** Twilio delivery status (e.g. "queued", "sent", "delivered", "failed"). */
    status: string;
    /** Recipient address, including the "whatsapp:" prefix. */
    to: string;
    /** Sender address, including the "whatsapp:" prefix. */
    from: string;
    /** Raw Twilio API response for the created message. */
    providerResponse: Record<string, unknown>;
}
