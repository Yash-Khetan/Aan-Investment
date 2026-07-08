import type { SMSResult } from "../types/sms.types";
import { ProviderConfigError, SMSDeliveryError } from "../utils/errors";
import { assertValidPhoneNumber, assertNonEmptyMessage } from "../utils/validators";
import { notificationLogger } from "../utils/logger";
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

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
        throw new ProviderConfigError(
            "SMS service is not configured. Missing required environment variable: TWILIO_PHONE_NUMBER."
        );
    }

    try {
        const client = getTwilioClient();

        const result = await client.messages.create({
            to: phoneNumber,
            from,
            body: message,
        });

        notificationLogger.success("SMS", phoneNumber);

        return {
            success: result.status !== "failed" && result.status !== "undelivered",
            sid: result.sid,
            status: result.status,
            to: result.to,
            from: result.from ?? from,
            providerResponse: result.toJSON() as Record<string, unknown>,
        };
    } catch (error) {
        notificationLogger.failure("SMS", phoneNumber, error);

        if (error instanceof ProviderConfigError) {
            throw error;
        }

        throw new SMSDeliveryError(
            `Failed to send SMS to "${phoneNumber}": ${error instanceof Error ? error.message : "Unknown error"}`,
            error
        );
    }
}
