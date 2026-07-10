/**
 * Escapes the five XML/HTML metacharacters so a value can be interpolated into
 * an HTML document or HTML email body as TEXT.
 *
 * Only safe for element content and quoted attribute values. It is NOT
 * sufficient inside a <script>, a <style>, an unquoted attribute, or a URL
 * context — those need context-specific encoding.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
