import { Router } from "express";

/**
 * TEMPORARY development-only reset-password page.
 *
 * The forgot-password email links to `${APP_PASSWORD_RESET_URL}?token=…`, which
 * in development points back at this server. Until a real front-end exists,
 * these two routes render a page that collects a new password and POSTs it to
 * the existing `/auth/reset-password` API.
 *
 * This router holds NO business logic. It does not read the database, does not
 * validate the password, and does not touch the token beyond handing it back to
 * the API. Every rule — token validity, expiry, single-use, the password policy,
 * argon2id hashing, session revocation — stays in AuthService.resetPassword.
 *
 * app.ts mounts this ONLY when `!config.isProduction`. Delete this folder once
 * the front-end owns the reset page.
 *
 * The script lives at its own URL rather than inline because helmet's default
 * CSP sends `script-src 'self'` and `script-src-attr 'none'` — an inline
 * <script> or an onclick= attribute would be blocked and the page would do
 * nothing. Serving it same-origin also means the token is read from
 * `location.search` in the browser and is never interpolated into the HTML, so
 * there is no reflected-XSS surface here.
 */
export const devResetPasswordRouter = Router();

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset your password</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 26rem; margin: 4rem auto; padding: 0 1rem; }
  h1 { font-size: 1.25rem; }
  label { display: block; margin-top: 1rem; font-size: .875rem; }
  input { width: 100%; padding: .5rem; margin-top: .25rem; box-sizing: border-box; }
  button { margin-top: 1.5rem; padding: .6rem 1rem; width: 100%; cursor: pointer; }
  button[disabled] { cursor: not-allowed; opacity: .6; }
  #message { margin-top: 1rem; padding: .75rem; border-radius: 4px; display: none; white-space: pre-line; }
  #message.error { display: block; background: #fde8e8; color: #8a1c1c; }
  #message.success { display: block; background: #e6f6ec; color: #14532d; }
  .banner { background: #fff6e0; border: 1px solid #e6c565; padding: .5rem .75rem; font-size: .8rem; }
</style>
</head>
<body>
  <p class="banner">Development page. Not served in production.</p>
  <h1>Reset your password</h1>
  <form id="form">
    <label>New password
      <input type="password" id="newPassword" autocomplete="new-password" required>
    </label>
    <label>Confirm password
      <input type="password" id="confirmPassword" autocomplete="new-password" required>
    </label>
    <button type="submit" id="submit">Reset password</button>
  </form>
  <div id="message"></div>
  <script src="/reset-password.js"></script>
</body>
</html>`;

/**
 * Confirm-password equality is checked here only because the two fields exist
 * only here — the API takes a single `newPassword`. Password STRENGTH is not
 * checked client-side; resetPasswordSchema owns that, and its 422 is rendered
 * as-is, so the policy has exactly one definition.
 */
const SCRIPT = `(function () {
  var form = document.getElementById("form");
  var message = document.getElementById("message");
  var submit = document.getElementById("submit");
  var token = new URLSearchParams(window.location.search).get("token");

  function show(text, kind) {
    message.textContent = text;
    message.className = kind;
  }

  if (!token) {
    show("This link is missing its reset token. Request a new password reset email.", "error");
    submit.disabled = true;
    return;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var newPassword = document.getElementById("newPassword").value;
    var confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
      show("Passwords do not match.", "error");
      return;
    }

    submit.disabled = true;
    show("Resetting…", "");

    fetch("/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: token, newPassword: newPassword })
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (result.ok && result.body.success) {
          form.style.display = "none";
          show("Password updated successfully. Please login again.", "success");
          return;
        }
        var error = result.body.error || {};
        var text = error.message || "Password reset failed.";
        if (Array.isArray(error.details)) {
          text += "\\n" + error.details.map(function (d) { return "• " + d.message; }).join("\\n");
        }
        show(text, "error");
        submit.disabled = false;
      })
      .catch(function () {
        show("Could not reach the server. Please try again.", "error");
        submit.disabled = false;
      });
  });
})();`;

devResetPasswordRouter.get("/reset-password", (_req, res) => {
    res.type("html").send(PAGE);
});

devResetPasswordRouter.get("/reset-password.js", (_req, res) => {
    res.type("application/javascript").send(SCRIPT);
});
