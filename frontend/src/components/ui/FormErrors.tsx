import { ApiError } from "../../lib/api";

/** Human-readable label for a dotted/bracketed field path, e.g. "promoters.0.email" -> "Promoters #1 Email". */
function humanizeField(field: string): string {
  return field
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part.replace(/([a-z])([A-Z])/g, "$1 $2")))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Renders an error thrown by `apiRequest` in plain language. When the backend
 * rejected the request with field-level validation issues (422), lists each
 * one against its field instead of the generic "Validation failed" message —
 * so the person filling the form can see exactly what to fix without opening
 * devtools.
 */
export function FormErrors({ error }: { error: unknown }) {
  if (!error) return null;

  if (error instanceof ApiError && error.details && error.details.length > 0) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <div className="font-medium">Please fix the following before submitting:</div>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          {error.details.map((d, i) => (
            <li key={i}>
              <span className="font-medium">{humanizeField(d.field)}</span> — {d.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error instanceof Error ? error.message : "Something went wrong. Please try again."}
    </div>
  );
}
