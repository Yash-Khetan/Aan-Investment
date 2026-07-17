# Notifications Module

Reusable notification module for the LMS backend. Exposes email, SMS, and
WhatsApp sending to the rest of the application (auth, loans, collections,
scheduler, reports, ...) through a single service, with no business logic of
its own.

## Folder structure

```
notifications/
├── services/
│   ├── email.service.ts         # Nodemailer transport + sendEmail()
│   ├── sms.service.ts           # Twilio SMS + sendSMS()
│   ├── whatsapp.service.ts      # Twilio WhatsApp + sendWhatsapp()
│   └── notification.service.ts  # notificationService — the only import other modules should use
├── repositories/
│   └── notification.repository.ts  # Persists one row per dispatch
├── types/
│   ├── notification.types.ts    # NotificationChannel, NotificationStatus, NotificationRecordMeta
│   ├── email.types.ts           # EmailOptions, EmailAttachment, EmailResult
│   ├── sms.types.ts             # SMSResult
│   └── whatsapp.types.ts        # WhatsappResult
├── utils/
│   ├── errors.ts                # Custom error hierarchy
│   ├── validators.ts            # Email / phone / header validation
│   └── twilioClient.ts          # Shared lazy Twilio client (SMS + WhatsApp)
├── .env.example                 # Provider credentials only
└── index.ts                     # Public exports
```

Other modules import only from `notifications/index.ts`:

```ts
import { notificationService } from "../notifications";
```

## Dispatching

Every send takes a `NotificationRecordMeta` and writes one row to the
`notifications` table — on success **and** on failure — so delivery history is
queryable.

```ts
await notificationService.sendEmail(
    {
        to: "borrower@example.com",
        subject: "Payment received",
        text: "We've received your payment.",
        // html, cc, bcc, replyTo, attachments are all optional
    },
    {
        userId: borrower.id,
        title: "Payment received",
        message: "We've received your payment.", // what gets PERSISTED
        link: "/payments/123",                    // optional
    },
);
```

`meta.message` is what lands in the database. **It is not the delivered body.**
Pass a summary that is safe to store at rest — never the rendered body, which
may contain a single-use token, reset link, or OTP.

Recording a dispatch never changes its outcome: if the audit insert fails, the
error is logged and the send's own result (or its original error) still
propagates.

## Configuration

All provider variables are read through `src/config`, never `process.env`, and
all are optional at boot. A channel throws `ProviderConfigError` at send time if
its own variables are missing.

See `.env.example` in this folder for `SMTP_*` and `TWILIO_*`. They belong in
`backend/.env` alongside the application-level variables.

## Results

- `EmailResult` — `success`, `messageId`, `accepted`, `rejected`.
- `SMSResult` / `WhatsappResult` — `success`, `sid`, `status`.

Raw provider payloads are deliberately not returned: Twilio's message
representation embeds the account SID and API URIs.

## Error handling

All errors extend `NotificationError` (`utils/errors.ts`), so callers can catch
broadly or narrowly:

- `InvalidRecipientError` — malformed email address or phone number.
- `InvalidNotificationContentError` — empty body, or a subject/replyTo containing a line break.
- `ProviderConfigError` — a required environment variable is missing.
- `EmailDeliveryError` — Nodemailer failed to send, or no `html`/`text` was given.
- `SMSDeliveryError` / `WhatsappDeliveryError` — Twilio failed to send.

Delivery-error *messages* are generic. The provider's own message — which can
carry the SMTP username and server banner — is attached as `error.cause` for
server-side logging, so an error handler can never surface it to a client.

```ts
try {
    await notificationService.sendWhatsapp(phone, message, meta);
} catch (error) {
    if (error instanceof InvalidRecipientError) {
        // bad phone number — surface to the caller
    }
    // ... or just log/rethrow NotificationError generically
}
```

## Recipient safety

`utils/validators.ts` rejects address separators (`,` `;` `<` `>` quotes,
whitespace) inside an email address, because Nodemailer parses an address string
as an address *list* — otherwise one stored address could fan a message out to
an attacker. Subject and `replyTo` are additionally checked for CR/LF, which
would let a caller inject arbitrary SMTP headers.

Callers that interpolate user-controlled values into the `html` body must escape
them first (`src/common/html.ts` → `escapeHtml`). The module does not render
templates and does not escape for you.

## Logging

Sends are logged through the shared application logger (`src/utils/logger.ts`)
with the channel, the outcome, and the provider message id. Credentials, tokens,
message bodies, and raw provider payloads are never logged.
