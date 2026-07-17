export interface SMSResult {
    success: boolean;
    /** Twilio message SID. */
    sid: string;
    /** Twilio delivery status (e.g. "queued", "sent", "delivered", "failed"). */
    status: string;
}
