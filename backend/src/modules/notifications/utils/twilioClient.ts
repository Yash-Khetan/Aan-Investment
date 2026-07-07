import twilio from "twilio";
import type { Twilio } from "twilio";
import { ProviderConfigError } from "./errors";

/**
 * Lazily-initialized, shared Twilio REST client used by both the SMS
 * and WhatsApp services. Reading `process.env` at call time (rather
 * than at module load) ensures this works regardless of when `dotenv`
 * is configured relative to this module being imported.
 */
let client: Twilio | null = null;

export function getTwilioClient(): Twilio {
    if (client) {
        return client;
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        throw new ProviderConfigError(
            "Twilio is not configured. Missing one or more required environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN."
        );
    }

    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return client;
}
