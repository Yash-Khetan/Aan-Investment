/**
 * Simple manual test script for the WhatsApp service.
 * Run with: npx tsx src/notifications/tests/whatsapp_test.ts
 */

import "dotenv/config";
import { notificationService } from "../index";

async function main() {
    const result = await notificationService.sendWhatsapp(
        String(process.env.personal_whatsapp_number), // <-- put recipient phone number here, E.164 format e.g. +14155552671
        "This is a test WhatsApp message from the notifications module.",
        {
            userId: String(process.env.TEST_USER_ID),
            title: "Test WhatsApp Message",
        }
    );

    console.log(result);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
