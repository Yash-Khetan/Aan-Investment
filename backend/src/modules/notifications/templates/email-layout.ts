/**
 * Shared HTML layout for outbound emails. Produces a simple branded "card"
 * that renders consistently across email clients: table-based structure,
 * inline styles only, no external assets.
 *
 * Callers are responsible for escaping any user-controlled values they
 * interpolate into `bodyHtml` (see common/html escapeHtml).
 */

const BRAND_NAME = "Aan Investment";
const BRAND_COLOR = "#1a3c6e";
const ACCENT_COLOR = "#2563eb";

export interface EmailLayoutOptions {
    /** Hidden preview line shown next to the subject in most inboxes. */
    previewText?: string;
    /** Pre-escaped HTML fragments rendered inside the card body. */
    bodyHtml: string;
}

/** Renders a call-to-action button. `href` must be a trusted, encoded URL. */
export function emailButton(href: string, label: string): string {
    return (
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">` +
        `<tr><td style="border-radius:6px;background-color:${ACCENT_COLOR};">` +
        `<a href="${href}" target="_blank" ` +
        `style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;` +
        `font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">` +
        `${label}</a>` +
        `</td></tr></table>`
    );
}

export function renderEmailLayout({ previewText, bodyHtml }: EmailLayoutOptions): string {
    const preheader = previewText
        ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}</div>`
        : "";

    return (
        `<!DOCTYPE html>` +
        `<html lang="en">` +
        `<body style="margin:0;padding:0;background-color:#f4f5f7;">` +
        preheader +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">` +
        `<tr><td align="center">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">` +
        // Header
        `<tr><td style="background-color:${BRAND_COLOR};border-radius:8px 8px 0 0;padding:20px 32px;">` +
        `<span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">` +
        `${BRAND_NAME}</span>` +
        `</td></tr>` +
        // Body card
        `<tr><td style="background-color:#ffffff;padding:32px;border-radius:0 0 8px 8px;` +
        `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">` +
        bodyHtml +
        `</td></tr>` +
        // Footer
        `<tr><td style="padding:20px 32px;text-align:center;">` +
        `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8a94a6;">` +
        `&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br>` +
        `This is an automated message &mdash; please do not reply to this email.` +
        `</p>` +
        `</td></tr>` +
        `</table>` +
        `</td></tr></table>` +
        `</body></html>`
    );
}
