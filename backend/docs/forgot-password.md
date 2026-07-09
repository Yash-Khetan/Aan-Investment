# Forgot Password & Reset Password — Implementation

Reference for maintainers of this repository. Describes what the code in
`backend/src/modules/auth` and `backend/src/modules/notifications` actually
does. Line references are to the files as they exist at the time of writing.

---

## 1. Feature Overview

### Problem

A user who cannot log in has no way to recover their account. This feature lets
them prove control of their registered email address and set a new password,
without an administrator and without any endpoint ever revealing whether a
given email is registered.

### High-level flow

```
POST /auth/forgot-password  →  mint a random token, store its SHA-256 hash,
                               email the raw token as a link, respond 200
                               (identically whether or not the account exists)

POST /auth/reset-password   →  hash the presented token, look it up, check
                               expiry + single-use, argon2-hash the new
                               password, write it, destroy the token,
                               destroy every session
```

The raw token exists in exactly two places: the outbound email body, and the
`?token=` query parameter of the link the user clicks. It is never stored, never
logged, and never returned over HTTP.

---

## 2. Complete Request Flow

### `POST /auth/forgot-password`

Body: `{ "email": "user@example.com" }`

1. `validate({ body: forgotPasswordSchema })` (`auth.routes.ts`) parses the body.
   The `email` field is preprocessed — trimmed and lowercased — then checked with
   `z.email()`. A malformed address fails here with **422** and never reaches the
   service. Parsed output lands on `req.valid.body`.
2. `controller.forgotPassword` reads `req.valid.body` and calls
   `authService.forgotPassword(input)`. It ignores the return value (there is
   none).
3. `AuthService.forgotPassword`:
   - `users.findByEmail(email)` — exact match on the stored (lowercased) address,
     `deleted_at IS NULL`.
   - If no user, **or the user is inactive**, the method returns immediately.
     Nothing is written, no email is sent.
   - `resets.deleteAllForUser(user.id)` — invalidates any previously issued
     token, so at most one reset token per user is ever live.
   - `randomToken(32)` produces the raw token; `sha256Hex(rawToken)` produces the
     stored value; `expiresAt = now + 30 minutes`.
   - `resets.create({ userId, tokenHash, expiresAt })` inserts into
     `password_reset_tokens`.
   - `sendResetEmail(user, rawToken)` (see §5).
4. Controller responds **200** with a fixed message:
   `"If an account exists for that email, a reset link has been sent."`

The 200 is returned for an unknown email, an inactive account, a known account,
and even when the email fails to send. See §7.

**The SMTP send is synchronous inside the request.** A live run measured this
endpoint at **6.1 s**. An unreachable SMTP host will hold the request open for
the connection timeout. See §11.

### `POST /auth/reset-password`

Body: `{ "token": "<raw token>", "newPassword": "<new password>" }`

1. `validate({ body: resetPasswordSchema })` enforces a non-empty `token` and the
   password policy: 8–128 characters, at least one letter, at least one digit.
   A violation is **422** and never reaches the service.
2. `controller.resetPassword` calls `authService.resetPassword(input)`.
3. `AuthService.resetPassword`:
   - `resets.findByTokenHash(sha256Hex(input.token))` — the presented raw token
     is hashed and matched against the stored hash. The raw token is never
     compared directly because it is never stored.
   - Rejects with **400 `"Invalid or expired reset token"`** if the record is
     missing, `record.used` is true, or `record.expiresAt <= now`. All three
     produce the identical message.
   - `passwordUtil.hash(newPassword)` → argon2id PHC string.
   - `users.updatePasswordHash(record.userId, newHash)`.
   - `resets.markUsed(record.id)`.
   - `resets.deleteAllForUser(record.userId)`.
   - `sessions.deleteAllForUser(record.userId)`.
4. Controller responds **200**:
   `"Password has been reset. Please log in again."`

**These four writes are not wrapped in a transaction.** If the process dies
between `updatePasswordHash` and `deleteAllForUser`, the password is changed but
old sessions survive. See §11.

---

## 3. Reset Token

### How it is generated

`auth.service.ts` → `randomToken(RESET_TOKEN_BYTES)` from `common/crypto.ts`:

```ts
randomBytes(32).toString("base64url")   // 256 bits of entropy, URL-safe
```

`RESET_TOKEN_BYTES = 32` and `RESET_TOKEN_TTL_MINUTES = 30` live in
`auth.constants.ts`.

`base64url` matters: the token is interpolated into a query string. It is still
passed through `encodeURIComponent` when the link is built, which is redundant
for this alphabet but correct if the alphabet ever changes.

### Why random, not a JWT

A JWT is self-validating and stateless — which is exactly wrong here. A reset
token must be **revocable** and **single-use**, and both properties require
server-side state that is consulted on every use. Once that row exists, the JWT
buys nothing: its signature, claims, and expiry duplicate columns we already
have to read. A JWT would also be longer, and would leak its claims to anyone
who reads the email.

An opaque 256-bit random string carries no information, cannot be forged, and
its validity is defined entirely by the row that backs it. Deleting the row
revokes it instantly.

This mirrors the refresh tokens in this codebase, which are opaque for the same
reason (`auth.utils.ts` → `generateRefreshToken`). Only the **access** token is a
JWT, because it is deliberately stateless and short-lived.

### Why only the SHA-256 hash is stored

`password_reset_tokens.token` holds `sha256Hex(rawToken)` — 64 hex characters.

A reset token is a bearer credential: whoever holds it can take over the account
until it expires. If the table were readable — a SQL injection, a leaked backup,
an over-broad admin query, a logging accident — plaintext tokens would be
immediately usable. Storing the hash means a database read yields nothing
usable, because the hash cannot be presented to `/auth/reset-password` (it would
be hashed again and fail to match).

Lookup still works because the operation is deterministic: hash the incoming
token, match on the hash. `password_reset_token_idx` is a unique index on that
column, so the lookup is a single index probe.

SHA-256 rather than argon2 here on purpose. Argon2 is slow *by design*, to make
guessing low-entropy human passwords expensive. A 256-bit random token is not
guessable, so there is nothing to slow down; a fast digest is the right tool. The
same reasoning is written into `common/crypto.ts`.

### Expiry

`expiresAt = Date.now() + 30 * 60 * 1000`, stored as `timestamptz`. Checked in
the service, not the query: `record.expiresAt.getTime() <= Date.now()`.

An expired row is **not** deleted on the failed attempt — it is left in place and
cleaned up by the next `deleteAllForUser` (on re-issue or on a successful reset).
There is no background reaper; expired rows accumulate until one of those runs.

### Single-use logic — read this carefully

There are two mechanisms, and only one of them is load-bearing.

`resetPassword` calls `markUsed(record.id)` and then
`deleteAllForUser(record.userId)`. The second call **deletes the row the first
call just updated**. In the normal path the `used` column is written and then
immediately discarded.

So single-use is enforced by **deletion**, not by the `used` flag. A replayed
token finds no row and takes the "missing record" branch. The `if (record.used)`
check only becomes reachable if a previous `deleteAllForUser` failed after
`markUsed` succeeded — a belt-and-braces path for a partially-applied reset (see
the transaction note in §2).

`forgotPassword` also calls `deleteAllForUser` *before* minting a new token, so
requesting a second reset link silently invalidates the first.

Do not remove `markUsed` on the assumption that it is dead code. It is the only
thing that makes the non-transactional sequence safe against a crash between the
two writes.

---

## 4. Password Reset Flow

### Token verification

Hash-then-lookup, as above. Three failure modes — unknown, used, expired — all
return **400** with the same message, so a caller cannot distinguish "this token
never existed" from "this token expired ten minutes ago."

### Password validation

Enforced by `resetPasswordSchema` in `auth.validators.ts`, at the route edge:

| Rule | Reason (from the code comments) |
|---|---|
| min 8 | basic brute-force resistance |
| max 128 | bounds the argon2 input — an unbounded password is a DoS vector |
| `/[A-Za-z]/` | at least one letter |
| `/[0-9]/` | at least one digit |

Note the asymmetry with `loginSchema`, which requires only a non-empty password.
Login deliberately does not enforce policy: the rules may have changed since the
account was created, and rejecting at login would leak the current policy.
Reset **sets** a credential, so it must enforce.

### Argon2 hashing

`passwordUtil.hash` → `argon2.hash(plain, ARGON2_OPTIONS)` with, from
`auth.constants.ts`:

```ts
type:        argon2.argon2id   // hybrid: GPU- and side-channel-resistant
memoryCost:  19456             // KiB (~19 MiB) — the anti-GPU/ASIC lever
timeCost:    2                 // passes over memory
parallelism: 1                 // lanes
```

These are the OWASP-aligned minimums. Output is a self-describing PHC string
(`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`) which embeds the algorithm,
parameters, and salt — so there is no separate salt column, and raising the cost
parameters later does not invalidate existing hashes.

`passwordUtil.verify` returns `false` rather than throwing on a malformed or
unknown-format hash, so callers get a clean boolean.

### Database writes, in order

1. `users.password_hash` ← the new PHC string, plus `updated_at = now()`.
2. `password_reset_tokens.used` ← `true` for the consumed row.
3. All rows in `password_reset_tokens` for that user ← deleted.
4. All rows in `user_sessions` for that user ← deleted.

### Why every device is logged out

A forgotten password is indistinguishable, from the server's side, from a stolen
one. If an attacker had logged in before the reset, their refresh token is a
still-valid, long-lived (7-day) credential sitting in `user_sessions` — and
changing the password does nothing to it, because refresh tokens are opaque
random strings validated against that table, not derived from the password.

`sessions.deleteAllForUser` removes every row, so every device must present
credentials again. The legitimate user's own session is destroyed too; that is
the intended cost.

**This does not immediately invalidate access tokens.** Access tokens are
stateless JWTs verified by signature alone, with no database hit
(`verifyAccessToken`). An access token issued before the reset stays valid until
it expires — up to `JWT_ACCESS_TTL` (default `15m`). The attacker keeps at most
15 minutes of read access and cannot renew. Closing that window entirely would
require a token denylist or a per-user token epoch, neither of which exists here.

---

## 5. Notifications Integration

### The boundary

`auth.service.ts` imports exactly one symbol from the notifications module:

```ts
import { notificationService } from "../notifications";
```

That import resolves to `notifications/index.ts`, the module's public surface.
Auth never reaches into `notifications/services/*`, never imports Nodemailer,
never touches `SMTP_*`. Grep confirms: `nodemailer` and `twilio` appear nowhere
outside `src/modules/notifications`.

### The call

`AuthService.sendResetEmail` builds the link and calls:

```ts
await notificationService.sendEmail(
    { to: user.email, subject: "Reset your password", text: ..., html: ... },
    { userId: user.id,
      title: "Password reset requested",
      message: "A password reset link was emailed to you. It expires in 30 minutes.",
      link: config.app.passwordResetUrl },
);
```

The second argument is `NotificationRecordMeta`. **`meta.message` is what gets
persisted to the `notifications` table — it is not the delivered body.** It is
deliberately tokenless, as is `meta.link` (the bare reset page URL, no
`?token=`). The raw token appears only in `text` and `html`, which are handed to
Nodemailer and then discarded.

This is load-bearing. An earlier version persisted `options.text ?? options.html`
as the notification message, which meant every password-reset row in the
`notifications` table contained a working reset link in plaintext. Given that the
schema already anticipates a user-facing notification feed (`is_read`,
`read_at`, `notif_user_idx`), that row was one endpoint away from handing out
account takeovers. Keep `meta.message` free of secrets.

`user.firstName` is interpolated into the `html` body and is user-controlled, so
it is passed through `escapeHtml` (`common/html.ts`) first. The plaintext `text`
body needs no escaping.

### Delivery, and failure

`notificationService.sendEmail` → `sendEmail` (`services/email.service.ts`) →
a lazily-created singleton Nodemailer transporter, configured from
`config.notifications.email`. Every dispatch writes one row to `notifications`
with `status = 'SUCCESS'` or `'FAILED'`, whether it succeeds or not.

`sendResetEmail` wraps the call in `try/catch` and only logs:

```ts
catch (error) {
    logger.error("Failed to send password-reset email", { err: error, userId: user.id });
}
```

A delivery failure — SMTP down, credentials rotated, missing env — must not
change the HTTP response, because a differing response would reintroduce the
enumeration leak that §7 exists to prevent. The token is still minted and still
valid; the user simply never receives it and must try again.

Note the consequence for operators: a **200 from `/auth/forgot-password` does not
mean an email was sent.** The `notifications` table is the source of truth for
delivery. Also note that `status = 'SUCCESS'` means the SMTP relay *accepted* the
message, not that it reached a mailbox.

### Why Auth holds no email logic

The channel is an implementation detail of delivery, not of authentication. Auth
knows *that* a reset link must reach the user; it does not know or care whether
that happens over SMTP, SMS, or WhatsApp. Keeping Nodemailer behind
`notificationService` means the transport can change without touching auth, every
dispatch is recorded in one place, and the SMTP credentials have exactly one
consumer.

---

## 6. Database Changes

**No schema changes were required.** All three tables already existed in
`db/schema/auth.ts`. The `notifications` table already existed in
`db/schema/notification.ts`. This feature is pure application code over the
existing schema.

### Tables read and written

| Table | Read | Written |
|---|---|---|
| `users` | `findByEmail`, `findById` | `password_hash`, `updated_at` |
| `password_reset_tokens` | `findByTokenHash` | insert, `used`, delete |
| `user_sessions` | — | delete (all rows for the user) |
| `notifications` | — | insert (one row per dispatch) |

### What is stored where

**`users.password_hash`** — `varchar(255)`. The argon2id PHC string. Contains the
algorithm, parameters, salt, and digest. Never the plaintext password. Nothing
else in the codebase reads this column except `passwordUtil.verify`.

**`password_reset_tokens`** —
- `token` `varchar(255)` — the **SHA-256 hex digest** of the raw token, 64
  characters. Unique index `password_reset_token_idx`. Never the raw token.
- `expires_at` `timestamptz` — absolute expiry, `created_at + 30 minutes`.
- `used` `boolean` — set to `true` on consumption, then the row is deleted (§3).
- `user_id` — `ON DELETE CASCADE`, so deleting a user reaps their tokens.

**`user_sessions`** —
- `refresh_token` `text` — despite the column name, this stores the
  **SHA-256 hex digest** of the opaque refresh token, never the raw value. The
  incoming cookie is hashed and matched by hash (`hashRefreshToken`).
- `expires_at` `timestamptz` — `now + REFRESH_TOKEN_TTL_DAYS` (default 7).
- `ip_address`, `user_agent` — captured from the request for the audit trail.
- One row per active login (per device). Reset deletes them all.

---

## 7. Security Considerations

**Generic success response.** `/auth/forgot-password` returns the identical 200
body for a registered email, an unregistered email, a soft-deleted user, an
inactive user, and a failed send. Any difference — status code, body, or a
noticeable latency gap — turns the endpoint into an oracle that confirms whether
an address has an account here. That is a privacy leak on its own and a
target list for credential stuffing. `login` applies the same discipline with
`INVALID_CREDENTIALS_MESSAGE`, returned identically for an unknown email and a
wrong password.

**SHA-256 hashing of reset tokens.** Makes the token table useless to anyone who
reads it. Fast digest is correct because the input is 256 bits of randomness, not
a guessable password. See §3.

**Argon2 password hashing.** Memory-hard, so each guess costs ~19 MiB and two
passes, which is what defeats GPU and ASIC cracking rigs — bcrypt is only
CPU-hard. `argon2id` additionally resists side-channel attacks.

**Single-use tokens.** A reset link travels through email, which is stored,
forwarded, indexed, and synced. Treat it as public once sent. Consuming the token
means a copy of the email recovered later is inert.

**Expiry (30 minutes).** Bounds the window in which an intercepted or
still-sitting-in-the-inbox link is usable. Short enough to matter, long enough
for a real user to notice the mail and act.

**Session invalidation after reset.** Refresh tokens are independent of the
password and outlive it. Without this, resetting the password would not evict an
attacker who already holds one. See §4 — and note the residual ≤15-minute access
token window.

**No plaintext passwords.** Nothing writes a password anywhere. The plaintext
exists only as a request field and an argon2 input, both discarded when the
request ends. It is not logged: the global error handler logs `err` objects, and
`pino` never sees the request body.

**No plaintext reset tokens stored.** The raw token exists in the email body, in
the user's click, and in memory during the two requests. `notifications.message`
and `notifications.link` are explicitly tokenless (§5). The HTTP response never
carries it — `forgotPassword` returns `void` precisely so no caller can leak it
by accident.

**Also worth knowing:**
- Reset endpoints sit behind only the global limiter — 100 requests / 15 min /
  IP (`config.rateLimit`). That is generous for both password guessing and for
  using the SMTP relay as a mail cannon. See §11.
- The refresh cookie is `httpOnly`, `secure` in production, and scoped to
  `path=/auth`, so it is never sent to feature routes.
- `NotificationError` does not extend `AppError`, so it lands in the error
  handler's unexpected-error branch: a generic 500 in production, but `message`
  and `stack` in development. Delivery errors therefore carry a generic message,
  with the provider's own text (which can include the SMTP username and server
  banner) attached as `error.cause` for server-side logs only.

---

## 8. File Responsibilities

| File | Role |
|---|---|
| `auth.routes.ts` | Mounts paths, attaches `validate(...)` per route. No logic. |
| `auth.controller.ts` | Thin HTTP adapter. Reads `req.valid.body` / cookie / `req.user`, calls **one** service method, sets or clears the cookie, sends JSON. No SQL, no crypto. Express 5 forwards async throws to the error handler automatically. |
| `auth.service.ts` | The use-case layer. Composes repositories and utils. Owns the reset flow's ordering and all its policy decisions. Contains no SQL and no HTTP. Repositories are constructor-injected (defaulting to singletons) so it is unit-testable with mocks. |
| `auth.repository.ts` | Data access, one class per table. `UserRepository`, `RoleRepository`, `PermissionRepository`, `SessionRepository`, `PasswordResetRepository`. Queries only — validity checks live in the service. The `db` handle is injected so a transaction can be passed in. |
| `auth.validators.ts` | Zod schemas + inferred input types. The single source of truth for request shape and password policy. |
| `auth.utils.ts` | Argon2 wrapper, JWT sign/verify, opaque refresh-token generation and hashing, refresh-cookie set/clear/read. |
| `auth.constants.ts` | Non-secret tuning constants: argon2 params, token byte lengths, the 30-minute TTL, the cookie name, the generic credential message. |
| `common/crypto.ts` | Domain-agnostic `randomToken` and `sha256Hex`. |
| `common/html.ts` | `escapeHtml`, for interpolating user-controlled values into HTML email bodies. |
| `modules/notifications` | Delivery. Public surface is `index.ts` → `notificationService`. Owns Nodemailer, Twilio, the SMTP config, and the `notifications` audit table. Knows nothing about auth. |

---

## 9. End-to-End Sequence

```
┌──────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌────┐  ┌───────────────┐  ┌─────┐
│ User │  │ Auth API│  │ Service  │  │ Repository │  │ DB │  │ Notifications │  │ SMTP│
└──┬───┘  └────┬────┘  └────┬─────┘  └─────┬──────┘  └─┬──┘  └───────┬───────┘  └──┬──┘
   │           │            │              │           │             │             │
   │ POST /auth/forgot-password {email}    │           │             │             │
   ├──────────►│            │              │           │             │             │
   │           │ validate(forgotPasswordSchema) → 422 on bad shape   │             │
   │           ├───────────►│              │           │             │             │
   │           │            │ findByEmail  │           │             │             │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │◄─────────────┤◄──────────┤             │             │
   │           │            │   (no user or inactive → return, still 200)          │
   │           │            │              │           │             │             │
   │           │            │ deleteAllForUser (invalidate prior tokens)           │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │              │           │             │             │
   │           │   raw = randomToken(32);  hash = sha256Hex(raw)     │             │
   │           │            │ resets.create{userId, hash, now+30m}   │             │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │              │           │             │             │
   │           │            │ sendEmail({to, subject, html: raw link},             │
   │           │            │            {message: tokenless summary})             │
   │           │            ├──────────────────────────────────────►│             │
   │           │            │              │           │  insert notifications row │
   │           │            │              │           │◄────────────┤             │
   │           │            │              │           │             ├────────────►│
   │           │            │              │           │             │   sendMail  │
   │           │            │              │           │             │◄────────────┤
   │           │            │◄──────────────────────────────────────┤             │
   │           │            │   (throw → caught + logged; response unchanged)      │
   │  200 "If an account exists…"          │           │             │             │
   │◄──────────┤            │              │           │             │             │
   │           │            │              │           │             │             │
   │◄══════════════════ email with  …/reset-password?token=<raw> ═══════════════════│
   │           │            │              │           │             │             │
   │ POST /auth/reset-password {token, newPassword}    │             │             │
   ├──────────►│            │              │           │             │             │
   │           │ validate(resetPasswordSchema) → 422 on weak password│             │
   │           ├───────────►│              │           │             │             │
   │           │            │ findByTokenHash(sha256Hex(token))      │             │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │◄─────────────┤◄──────────┤             │             │
   │           │   missing │ used │ expired  →  400 "Invalid or expired reset token"
   │           │            │              │           │             │             │
   │           │            │ hash = argon2id(newPassword)           │             │
   │           │            │ updatePasswordHash                     │             │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │ markUsed(id) │           │             │             │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │ resets.deleteAllForUser  │             │             │
   │           │            ├─────────────►├──────────►│             │             │
   │           │            │ sessions.deleteAllForUser  ← every device logged out │
   │           │            ├─────────────►├──────────►│             │             │
   │  200 "Password has been reset…"       │           │             │             │
   │◄──────────┤            │              │           │             │             │
   │           │            │              │           │             │             │
   │ POST /auth/login {email, newPassword} │           │             │             │
   ├──────────►│            │              │           │             │             │
   │           │            │ verify(argon2) → sign access JWT + new refresh session
   │           │            ├─────────────►├──────────►│             │             │
   │  200 {user, accessToken} + Set-Cookie: lms_refresh_token        │             │
   │◄──────────┤            │              │           │             │             │
```

---

## 10. Testing Performed

Verified end-to-end against the real Supabase database and live Gmail SMTP, by
booting the actual Express app and driving it over HTTP. **37 assertions, 0
failures**, plus 18 assertions covering the notifications module's injection
guards. The harnesses were throwaway and are not committed — there is no
automated test suite in this repository (`npm test` is still a stub).

| Scenario | Expected | Result |
|---|---|---|
| Valid email, registered user | 200, generic message; one reset row; email sent | pass |
| Invalid email shape (`not-an-email`) | 422 from `validate` | pass |
| Unknown email | 200, **byte-identical** body to the known-user case | pass |
| Known vs unknown response equality | asserted equal | pass |
| Raw token absent from HTTP response | asserted | pass |
| Exactly one reset token issued | re-issue invalidates prior | pass |
| Token stored hashed | matches `/^[0-9a-f]{64}$/` | pass |
| Reset token absent from `notifications.message` | asserted | pass |
| Reset token absent from `notifications.link` | asserted | pass |
| Expired token | 400 `"Invalid or expired reset token"` | pass |
| Reused token | 400, identical message | pass |
| Unknown token | 400, identical message | pass |
| Weak new password (`"weak"`) | 422 | pass |
| Successful password reset | 200 | pass |
| Login with new password | 200 + access token | pass |
| Login with old password | 401 `"Invalid email or password"` | pass |
| All sessions invalidated | only the post-reset login row remains | pass |
| SMTP misconfigured (`SMTP_HOST` unset) | 200; `notifications.status = FAILED`; no SMTP detail in body | pass |
| SMTP auth failure (bad password) | 200; `notifications.status = FAILED`; no SMTP detail in body | pass |

Email delivery was confirmed by the SMTP server echoing the recipient back in
`accepted` (`["user@example.com"]`, `rejected: []`) after a successful
`transporter.verify()` handshake, for both a direct `notificationService.sendEmail`
call and the full `/auth/forgot-password` flow through the running server.

Not covered: concurrent reset attempts for the same user, behaviour when the
process dies mid-reset, and rate-limit behaviour under load.

---

## 11. Known Gaps

Recorded here so the next maintainer does not have to rediscover them.

1. **The reset is not transactional.** `updatePasswordHash`, `markUsed`,
   `resets.deleteAllForUser`, and `sessions.deleteAllForUser` are four separate
   statements. A crash between them leaves a changed password with live sessions,
   or a consumed-but-undeleted token. `PasswordResetRepository` already accepts an
   injected `db` handle, so wrapping the sequence in `db.transaction(...)` is a
   small change.
2. **SMTP is synchronous.** `/auth/forgot-password` measured at 6.1 s in a live
   run. An unreachable relay holds the request for the full connection timeout.
   A queue, or at minimum a send timeout, would fix this.
3. **No dedicated rate limit** on `/auth/login` or `/auth/forgot-password`.
4. **Access tokens survive a reset** for up to `JWT_ACCESS_TTL`. See §4.
5. **Expired reset rows are never reaped** except by the next
   `deleteAllForUser` for that same user.
