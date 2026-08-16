/**
 * Bits shared by the Consumer and Commercial halves of the Borrower form.
 * Kept in one place so the two field sets stay visually identical and the
 * client-side patterns cannot drift from the backend's validators.
 */

/** Matches the backend's Indian-mobile format (an optional +91 prefix, then a 10-digit number starting 6-9). */
export const PHONE_PATTERN = "^(\\+91[- ]?)?[6-9][0-9]{9}$";
export const PHONE_TITLE = "Enter a valid 10-digit Indian mobile number, e.g. 9876543210 or +91 9876543210";

/** Matches the backend's PAN format: 5 letters, 4 digits, 1 letter (e.g. AAAAA9999A). */
export const PAN_PATTERN = "^[A-Za-z]{5}[0-9]{4}[A-Za-z]$";
export const PAN_TITLE = "Enter a valid PAN, e.g. AAAAA9999A";

/** Matches the backend's GSTIN format: 15 characters (state code + PAN + entity code + Z + checksum). */
export const GST_PATTERN = "^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$";
export const GST_TITLE = "Enter a valid 15-character GSTIN";

/** Matches the backend's Aadhaar format: 12 digits. */
export const AADHAAR_PATTERN = "^[0-9]{12}$";
export const AADHAAR_TITLE = "Enter a valid 12-digit Aadhaar number";

/** CIBIL "CKYC No." — the Central KYC Registry issues 14-digit identifiers. */
export const CKYC_PATTERN = "^[0-9]{14}$";
export const CKYC_TITLE = "Enter a valid 14-digit CKYC number";

/** CIBIL "Class of Activity 1" — 5-digit code from the handbook of instructions. */
export const CLASS_OF_ACTIVITY_PATTERN = "^[0-9]{5}$";
export const CLASS_OF_ACTIVITY_TITLE = "Enter the 5-digit class-of-activity code from the handbook of instructions";

export function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/** Placeholder row that makes a required <select> start empty instead of silently defaulting. */
export function ChooseOption({ label }: { label: string }) {
  return <option value="">— Select {label} —</option>;
}
