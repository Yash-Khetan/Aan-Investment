import twilio from "twilio";
import type { Twilio } from "twilio";
import { config } from "../../../config";
import { ProviderConfigError } from "./errors";

/** Lazily-initialized, shared Twilio REST client used by both the SMS and WhatsApp services. */
let client: Twilio | null = null;

export function getTwilioClient(): Twilio {
    if (client) {
        return client;
    }

    const { accountSid, authToken } = config.notifications.twilio;

    if (!accountSid || !authToken) {
        throw new ProviderConfigError(
            "Twilio is not configured. Missing one or more required environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.",
        );
    }

    client = twilio(accountSid, authToken);
    return client;
}
