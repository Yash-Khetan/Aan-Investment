import { config } from "../../../config";
import { logger } from "../../../utils/logger";
import type { WhatsappResult } from "../types/whatsapp.types";
import { ProviderConfigError, WhatsappDeliveryError } from "../utils/errors";
import { assertValidPhoneNumber, assertNonEmptyMessage } from "../utils/validators";
import { getTwilioClient } from "../utils/twilioClient";

const WHATSAPP_PREFIX = "whatsapp:";

/** Prefixes a number with "whatsapp:" if it isn't already, so this works whether callers pass a bare E.164 number or an already-prefixed one. */
function toWhatsappAddress(phoneNumber: string): string {
    return phoneNumber.startsWith(WHATSAPP_PREFIX) ? phoneNumber : `${WHATSAPP_PREFIX}${phoneNumber}`;
}

function stripWhatsappPrefix(phoneNumber: string): string {
    return phoneNumber.startsWith(WHATSAPP_PREFIX) ? phoneNumber.slice(WHATSAPP_PREFIX.length) : phoneNumber;
}

/**
 * Sends a WhatsApp message via the Twilio WhatsApp API. Compatible with both
 * the Twilio Sandbox number and a production-approved WhatsApp sender — the
 * "whatsapp:" prefix is applied automatically.
 *
 * @throws {InvalidRecipientError} if `phoneNumber` is not a valid E.164 number.
 * @throws {InvalidNotificationContentError} if `message` is empty.
 * @throws {ProviderConfigError} if required Twilio environment variables are missing.
 * @throws {WhatsappDeliveryError} if Twilio rejects or fails to send the message.
 */
export async function sendWhatsapp(phoneNumber: string, message: string): Promise<WhatsappResult> {
    const rawNumber = typeof phoneNumber === "string" ? stripWhatsappPrefix(phoneNumber) : phoneNumber;

    assertValidPhoneNumber(rawNumber);
    assertNonEmptyMessage(message, "WhatsApp");

    const fromNumber = config.notifications.twilio.whatsappFrom;
    if (!fromNumber) {
        throw new ProviderConfigError(
            "WhatsApp service is not configured. Missing required environment variable: TWILIO_WHATSAPP_NUMBER.",
        );
    }

    try {
        const client = getTwilioClient();

        const result = await client.messages.create({
            to: toWhatsappAddress(rawNumber),
            from: toWhatsappAddress(fromNumber),
            body: message,
        });

        logger.info("Notification dispatched", {
            channel: "WHATSAPP",
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

        logger.error("Notification failed", { channel: "WHATSAPP", status: "FAILED", err: error });

        throw new WhatsappDeliveryError("Failed to send WhatsApp message.", error);
    }
}
