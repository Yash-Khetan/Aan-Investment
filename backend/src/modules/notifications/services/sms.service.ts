import { config } from "../../../config";
import { logger } from "../../../utils/logger";
import type { SMSResult } from "../types/sms.types";
import { ProviderConfigError, SMSDeliveryError } from "../utils/errors";
import { assertValidPhoneNumber, assertNonEmptyMessage } from "../utils/validators";
import { getTwilioClient } from "../utils/twilioClient";

/**
 * Sends an SMS message via Twilio.
 *
 * @throws {InvalidRecipientError} if `phoneNumber` is not a valid E.164 number.
 * @throws {InvalidNotificationContentError} if `message` is empty.
 * @throws {ProviderConfigError} if required Twilio environment variables are missing.
 * @throws {SMSDeliveryError} if Twilio rejects or fails to send the message.
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
    assertValidPhoneNumber(phoneNumber);
    assertNonEmptyMessage(message, "SMS");

    const from = config.notifications.twilio.smsFrom;
    if (!from) {
        throw new ProviderConfigError(
            "SMS service is not configured. Missing required environment variable: TWILIO_PHONE_NUMBER.",
        );
    }

    try {
        const client = getTwilioClient();

        const result = await client.messages.create({ to: phoneNumber, from, body: message });

        logger.info("Notification dispatched", {
            channel: "SMS",
            status: "SUCCESS",
            sid: result.sid,
            providerStatus: result.status,
        });

        return {
            success: result.status !== "failed" && result.status !== "undelivered",
            sid: result.sid,
            status: result.status,
        };
    } catch (error) {
        if (error instanceof ProviderConfigError) {
            throw error;
        }

        logger.error("Notification failed", { channel: "SMS", status: "FAILED", err: error });

        throw new SMSDeliveryError("Failed to send SMS.", error);
    }
}
