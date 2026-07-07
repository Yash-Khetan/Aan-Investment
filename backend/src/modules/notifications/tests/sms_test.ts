/**
 * Simple manual test script for the SMS service.
 * Run with: npx tsx src/notifications/tests/sms_test.ts
 */

import "dotenv/config";
import { notificationService } from "../index";

async function main() {
    const result = await notificationService.sendSMS(
        String(process.env.TEST_RECIPIENT_PHONE), // <-- put recipient phone number here, E.164 format e.g. +14155552671
        "This is a test SMS from the notifications module.",
        {
            userId: String(process.env.TEST_USER_ID),
            title: "Test SMS",
        }
    );

    console.log(result);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
