# Notifications Module

Reusable notification module for the LMS backend. Exposes email and
WhatsApp sending to the rest of the application (auth, loans,
collections, scheduler, reports, ...) through a single service, with no
business logic of its own.

> SMS (Twilio) is implemented in `services/sms.service.ts` but is not
> covered by this README yet.

## Folder structure

```
notifications/
├── services/
│   ├── email.service.ts          # Nodemailer transport + sendEmail()
│   ├── whatsapp.service.ts       # Twilio WhatsApp + sendWhatsapp()
│   ├── sms.service.ts            # Twilio SMS (undocumented for now)
│   └── notification.service.ts  # notificationService wrapper — the only import other modules should use
├── types/
│   ├── email.types.ts             # EmailOptions, EmailAttachment, EmailResult
│   ├── whatsapp.types.ts          # WhatsappResult
│   └── sms.types.ts               # SMSResult
├── utils/
│   ├── errors.ts                  # Custom error hierarchy
│   ├── validators.ts              # Email / phone / message validation
│   ├── logger.ts                  # Success/failure logging (no secrets)
│   └── twilioClient.ts            # Shared lazy Twilio client (SMS + WhatsApp)
├── tests/
│   ├── email_test.ts              # Manual script to send a real test email
│   └── whatsapp_test.ts           # Manual script to send a real test WhatsApp message
└── index.ts                       # Public exports
```

Other modules should only ever import from `notifications/index.ts`:

```ts
import { notificationService } from "../notifications";
```

## Email

Uses Nodemailer with a single SMTP transporter, created lazily on first
send and reused for the lifetime of the process.

```ts
await notificationService.sendEmail({
    to: "borrower@example.com",
    subject: "Payment received",
    text: "We've received your payment.",
    // html, cc, bcc, replyTo, attachments are all optional
});
```

`EmailOptions` (see `types/email.types.ts`):

| Field         | Required | Notes                                   |
|---------------|----------|------------------------------------------|
| `to`          | yes      | `string` or `string[]`                   |
| `subject`     | yes      |                                            |
| `html`        | one of   | at least one of `html` / `text` required |
| `text`        | one of   |                                            |
| `cc`          | no       | `string` or `string[]`                   |
| `bcc`         | no       | `string` or `string[]`                   |
| `replyTo`     | no       |                                            |
| `attachments` | no       | `EmailAttachment[]`                      |

Returns an `EmailResult`: `success`, `messageId`, `accepted`,
`rejected`, `response`.

Required environment variables:

```
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
```

## WhatsApp

Uses the Twilio WhatsApp API. The `whatsapp:` prefix is applied
automatically to both the recipient and sender numbers, so callers can
pass a plain E.164 number either way — this makes the same code work
against the Twilio Sandbox number or an approved production sender.

```ts
await notificationService.sendWhatsapp(
    "+14155552671",
    "Your EMI is due in 3 days."
);
```

Returns a `WhatsappResult`: `success`, `sid`, `status`, `to`, `from`,
`providerResponse`.

Required environment variables:

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_NUMBER
```

## Error handling

All errors extend `NotificationError` (`utils/errors.ts`), so callers
can catch broadly or narrowly:

- `InvalidRecipientError` — malformed email address or phone number.
- `InvalidNotificationContentError` — empty message body (WhatsApp).
- `ProviderConfigError` — a required environment variable is missing.
- `EmailDeliveryError` — Nodemailer failed to send, or no `html`/`text` was given.
- `WhatsappDeliveryError` — Twilio failed to send the WhatsApp message.

```ts
try {
    await notificationService.sendWhatsapp(phone, message);
} catch (error) {
    if (error instanceof InvalidRecipientError) {
        // bad phone number — surface to the caller
    }
    // ... or just log/rethrow NotificationError generically
}
```

## Logging

`utils/logger.ts` logs only the channel (`EMAIL` / `WHATSAPP`), the
destination, and success/failure (with the error message on failure).
It never logs SMTP/Twilio credentials, tokens, or raw provider
payloads.

## Manual testing

Two runnable scripts are provided under `tests/` for exercising the
real providers (they need valid `.env` values and will actually send a
message):

```bash
npx tsx src/notifications/tests/email_test.ts
npx tsx src/notifications/tests/whatsapp_test.ts
```
