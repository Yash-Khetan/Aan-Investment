/**
 * Simple manual test script for the email service.
 * Run with: npx tsx src/notifications/tests/email_test.ts
 */

import "dotenv/config";
import { notificationService } from "../index";

async function main() {
    const result = await notificationService.sendEmail({
        to: String(process.env.SMTP_TO), // <-- put recipient email here
        subject: "Test Email",
        text: "This is a test email from the notifications module.",
    });

    console.log(result);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
