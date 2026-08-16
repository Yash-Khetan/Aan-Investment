/**
 * The two CIBIL submission formats a borrower can be captured under. Everything
 * below that is split into CONSUMER_* / COMMERCIAL_* mirrors the two sheets of
 * the client's CIBIL workbook.
 */
export const BORROWER_TYPES = ["CONSUMER", "COMMERCIAL"] as const;
export type BorrowerType = (typeof BORROWER_TYPES)[number];

export const BORROWER_TYPE_LABELS: Record<BorrowerType, string> = {
  CONSUMER: "Consumer (Individual)",
  COMMERCIAL: "Commercial (Company, LLP, Partnership Firm, etc.)",
};

/** A coded dropdown value paired with the label used on the CIBIL sheet. */
export interface CodedOption {
  value: string;
  label: string;
}

export const CONSTITUTIONS = [
  "INDIVIDUAL",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "TRUST",
  "HUF",
  "OTHER",
  "BUSINESS_ENTITY_CREATED_BY_STATUTE",
  "CO_OPERATIVE_SOCIETY",
  "ASSOCIATION_OF_PERSONS",
  "GOVERNMENT",
  "SELF_HELP_GROUP",
] as const;

export const BORROWER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

/* ------------------------------------------------------------------ */
/* CIBIL Consumer sheet dropdowns                                     */
/* ------------------------------------------------------------------ */

export const GENDERS: CodedOption[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "TRANSGENDER", label: "Transgender" },
];

export const ADDRESS_CATEGORIES: CodedOption[] = [
  { value: "PERMANENT", label: "01 Permanent Address" },
  { value: "RESIDENCE", label: "02 Residence Address" },
  { value: "OFFICE", label: "03 Office Address" },
  { value: "NOT_CATEGORIZED", label: "04 Not Categorized" },
];

export const RESIDENCE_CODES: CodedOption[] = [
  { value: "OWNED", label: "01 Owned" },
  { value: "RENTED", label: "02 Rented" },
];

export const OWNERSHIP_INDICATORS: CodedOption[] = [
  { value: "INDIVIDUAL", label: "1 Individual" },
  { value: "AUTHORISED_USER", label: "2 Authorised User" },
  { value: "GUARANTOR", label: "3 Guarantor" },
  { value: "JOINT", label: "4 Joint" },
];

/* ------------------------------------------------------------------ */
/* CIBIL Commercial sheet dropdowns                                   */
/* ------------------------------------------------------------------ */

export const BUSINESS_CATEGORIES: CodedOption[] = [
  { value: "MICRO", label: "03 Micro" },
  { value: "SMALL", label: "04 Small" },
  { value: "MEDIUM", label: "05 Medium" },
  { value: "LARGE", label: "06 Large" },
  { value: "OTHERS", label: "07 Others" },
  { value: "RETAIL", label: "08 Retail" },
  { value: "AGRI", label: "09 Agri" },
];

export const BUSINESS_TYPES: CodedOption[] = [
  { value: "MANUFACTURING", label: "01 Manufacturing" },
  { value: "DISTRIBUTION", label: "02 Distribution" },
  { value: "WHOLESALE", label: "03 Wholesale" },
  { value: "TRADING", label: "04 Trading" },
  { value: "BROKING", label: "05 Broking" },
  { value: "SERVICE_PROVIDER", label: "06 Service Provider" },
  { value: "IMPORTING", label: "07 Importing" },
  { value: "EXPORTING", label: "08 Exporting" },
  { value: "AGRICULTURE", label: "09 Agriculture" },
  { value: "DEALERS", label: "10 Dealers" },
  { value: "OTHERS", label: "11 Others" },
];

/**
 * The commercial sheet's own "Borrower Type" column (Applicant / Co-Applicant).
 * Named Applicant Type in the UI so it is not confused with the
 * Consumer/Commercial selector that drives this whole form.
 */
export const APPLICANT_TYPES: CodedOption[] = [
  { value: "APPLICANT", label: "Applicant" },
  { value: "CO_APPLICANT", label: "Co-Applicant" },
];

export const RELATED_PERSON_TYPES: CodedOption[] = [
  { value: "RESIDENT_INDIAN_INDIVIDUAL", label: "Resident Indian Individual" },
  { value: "BUSINESS_ENTITY_REGISTERED_IN_INDIA", label: "Business Entity Registered in India" },
  { value: "BUSINESS_ENTITY_REGISTERED_OUTSIDE_INDIA", label: "Business Entity Registered Outside India" },
  { value: "FOREIGN_NON_RESIDENT_INDIAN_INDIVIDUAL", label: "Foreign/Non-Resident Indian Individual" },
];

export const RELATED_PERSON_RELATIONSHIPS: CodedOption[] = [
  { value: "SHAREHOLDER", label: "Shareholder" },
  { value: "HOLDING_COMPANY", label: "Holding Company" },
  { value: "SUBSIDIARY_COMPANY", label: "Subsidiary Company" },
  { value: "PROPRIETOR", label: "Proprietor" },
  { value: "PARTNER", label: "Partner" },
  { value: "TRUSTEE", label: "Trustee" },
  { value: "PROMOTER_DIRECTOR", label: "Promoter Director" },
  { value: "NOMINEE_DIRECTOR", label: "Nominee Director" },
  { value: "INDEPENDENT_DIRECTOR", label: "Independent Director" },
  { value: "DIRECTOR_SINCE_RESIGNED", label: "Director - Since Resigned" },
  { value: "INDIVIDUAL_MEMBER_OF_SHG", label: "Individual Member of SHG" },
  { value: "OTHER_DIRECTOR", label: "Other Director" },
  { value: "KARTA_HUF", label: "Karta (HUF)" },
  { value: "OTHERS", label: "Others" },
];

/**
 * Today as YYYY-MM-DD in the browser's timezone — the `max` for any date input
 * that must not accept a future date. Mirrors the backend's `pastOrToday` rule,
 * which is also computed in local time.
 */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** CIBIL commercial "Related Person" block — stored as promoters. */
export interface Promoter {
  id?: string;
  name: string;
  designation?: string;
  gender?: string;
  relatedPersonType?: string;
  relationship?: string;
  dateOfBirth?: string;
  pan?: string;
  aadhar?: string;
  din?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  shareholdingPercent?: number;
}

export interface Borrower {
  id: string;
  borrowerType: BorrowerType;
  borrowerCode: string;
  name: string;
  groupName: string | null;
  constitution: string;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  pan: string | null;
  gst: string | null;
  cin: string | null;
  aadhaar: string | null;
  dateOfIncorporation: string | null;
  natureOfBusiness: string | null;
  /* CIBIL consumer */
  gender: string | null;
  dateOfBirth: string | null;
  addressCategory: string | null;
  residenceCode: string | null;
  ownershipIndicator: string | null;
  ckycNumber: string | null;
  /* CIBIL commercial */
  businessCategory: string | null;
  businessType: string | null;
  classOfActivity1: string | null;
  applicantType: string | null;
  internalRating: string | null;
  ratingRemarks: string | null;
  relationshipManagerId: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string | null;
}

export interface BorrowerDetail extends Borrower {
  promoters: Promoter[];
}

export interface CreateBorrowerInput {
  borrowerType: BorrowerType;
  borrowerCode: string;
  name: string;
  groupName?: string;
  constitution: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  pan?: string;
  gst?: string;
  cin?: string;
  aadhaar?: string;
  dateOfIncorporation?: string;
  natureOfBusiness?: string;
  gender?: string;
  dateOfBirth?: string;
  addressCategory?: string;
  residenceCode?: string;
  ownershipIndicator?: string;
  ckycNumber?: string;
  businessCategory?: string;
  businessType?: string;
  classOfActivity1?: string;
  applicantType?: string;
  internalRating?: string;
  ratingRemarks?: string;
  notes?: string;
  promoters?: Promoter[];
}

/** Master-field update payload. Every field is sent; nullable ones clear on empty string. */
export interface UpdateBorrowerInput {
  borrowerType: BorrowerType;
  borrowerCode: string;
  name: string;
  groupName: string | null;
  constitution: string;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  pan: string | null;
  gst: string | null;
  cin: string | null;
  aadhaar: string | null;
  dateOfIncorporation: string | null;
  natureOfBusiness: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  addressCategory: string | null;
  residenceCode: string | null;
  ownershipIndicator: string | null;
  ckycNumber: string | null;
  businessCategory: string | null;
  businessType: string | null;
  classOfActivity1: string | null;
  applicantType: string | null;
  internalRating: string | null;
  ratingRemarks: string | null;
  status: string;
  notes: string | null;
}

/** Controlled-input-friendly form state: every field is always a defined string. */
export interface BorrowerFormState {
  borrowerType: BorrowerType;
  borrowerCode: string;
  name: string;
  groupName: string;
  constitution: string;
  email: string;
  phone: string;
  alternatePhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  pan: string;
  gst: string;
  cin: string;
  aadhaar: string;
  dateOfIncorporation: string;
  natureOfBusiness: string;
  gender: string;
  dateOfBirth: string;
  addressCategory: string;
  residenceCode: string;
  ownershipIndicator: string;
  ckycNumber: string;
  businessCategory: string;
  businessType: string;
  classOfActivity1: string;
  applicantType: string;
  internalRating: string;
  ratingRemarks: string;
  status: string;
  notes: string;
}

/** Form keys that belong to exactly one borrower type. */
const CONSUMER_ONLY_KEYS = [
  "gender",
  "dateOfBirth",
  "addressCategory",
  "residenceCode",
  "ownershipIndicator",
  "ckycNumber",
] as const satisfies readonly (keyof BorrowerFormState)[];

const COMMERCIAL_ONLY_KEYS = [
  "businessCategory",
  "businessType",
  "classOfActivity1",
  "district",
  "applicantType",
] as const satisfies readonly (keyof BorrowerFormState)[];

/**
 * Blank out whatever belongs to the type that is *not* selected. Switching the
 * selector must not smuggle the other format's values through to the API — the
 * backend rejects fields that don't apply to the chosen borrower type.
 */
export function clearFieldsForOtherType(f: BorrowerFormState): BorrowerFormState {
  const stale = f.borrowerType === "CONSUMER" ? COMMERCIAL_ONLY_KEYS : CONSUMER_ONLY_KEYS;
  const cleared: BorrowerFormState = { ...f };
  for (const key of stale) cleared[key] = "";
  return cleared;
}

export const EMPTY_BORROWER_FORM: BorrowerFormState = {
  borrowerType: "CONSUMER",
  borrowerCode: "",
  name: "",
  groupName: "",
  constitution: "INDIVIDUAL",
  email: "",
  phone: "",
  alternatePhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  pan: "",
  gst: "",
  cin: "",
  aadhaar: "",
  dateOfIncorporation: "",
  natureOfBusiness: "",
  gender: "",
  dateOfBirth: "",
  addressCategory: "",
  residenceCode: "",
  ownershipIndicator: "",
  ckycNumber: "",
  businessCategory: "",
  businessType: "",
  classOfActivity1: "",
  applicantType: "",
  internalRating: "",
  ratingRemarks: "",
  status: "ACTIVE",
  notes: "",
};

export function borrowerToFormState(b: Borrower): BorrowerFormState {
  return {
    borrowerType: b.borrowerType,
    borrowerCode: b.borrowerCode,
    name: b.name,
    groupName: b.groupName ?? "",
    constitution: b.constitution,
    email: b.email ?? "",
    phone: b.phone ?? "",
    alternatePhone: b.alternatePhone ?? "",
    addressLine1: b.addressLine1 ?? "",
    addressLine2: b.addressLine2 ?? "",
    city: b.city ?? "",
    district: b.district ?? "",
    state: b.state ?? "",
    pincode: b.pincode ?? "",
    pan: b.pan ?? "",
    gst: b.gst ?? "",
    cin: b.cin ?? "",
    aadhaar: b.aadhaar ?? "",
    dateOfIncorporation: b.dateOfIncorporation ?? "",
    natureOfBusiness: b.natureOfBusiness ?? "",
    gender: b.gender ?? "",
    dateOfBirth: b.dateOfBirth ?? "",
    addressCategory: b.addressCategory ?? "",
    residenceCode: b.residenceCode ?? "",
    ownershipIndicator: b.ownershipIndicator ?? "",
    ckycNumber: b.ckycNumber ?? "",
    businessCategory: b.businessCategory ?? "",
    businessType: b.businessType ?? "",
    classOfActivity1: b.classOfActivity1 ?? "",
    applicantType: b.applicantType ?? "",
    internalRating: b.internalRating ?? "",
    ratingRemarks: b.ratingRemarks ?? "",
    status: b.status ?? "ACTIVE",
    notes: b.notes ?? "",
  };
}

/**
 * Drop blank optional fields from a Related Person row.
 *
 * Every text input starts life as "" and clearing one returns it to "". The API
 * treats these fields as optional — meaning *absent* — so an empty string is
 * present-but-invalid and fails the PAN/mobile/pincode format checks. Only
 * `name` is required, so it is always kept.
 */
/** The editable Related Person keys, in the order the form lays them out. */
const PROMOTER_TEXT_KEYS = [
  "gender",
  "relatedPersonType",
  "relationship",
  "dateOfBirth",
  "pan",
  "addressLine1",
  "city",
  "district",
  "state",
  "pincode",
  "phone",
] as const satisfies readonly (keyof Promoter)[];

/**
 * Update payload for one related person. Unlike create, a blank field is sent
 * as `null` rather than omitted — on an update that is how the user clears a
 * value they previously entered. `name` is required and so is never nulled.
 */
export function promoterToUpdateInput(p: Promoter): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: p.name.trim() };
  for (const key of PROMOTER_TEXT_KEYS) {
    const value = p[key];
    const trimmed = typeof value === "string" ? value.trim() : value;
    payload[key] = trimmed ? trimmed : null;
  }
  return payload;
}

/** Create payload for one related person, with blank optional fields omitted. */
export function promoterToCreateInput(p: Promoter): Promoter {
  return omitBlankPromoterFields(p);
}

function omitBlankPromoterFields(p: Promoter): Promoter {
  // `id` is deliberately never copied: it is server-owned and the create
  // payload schema is strict, so sending it would be rejected.
  const cleaned: Promoter = { name: p.name.trim() };

  const put = (key: keyof Omit<Promoter, "id" | "name" | "shareholdingPercent">, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) cleaned[key] = trimmed;
  };

  put("designation", p.designation);
  put("gender", p.gender);
  put("relatedPersonType", p.relatedPersonType);
  put("relationship", p.relationship);
  put("dateOfBirth", p.dateOfBirth);
  put("pan", p.pan);
  put("aadhar", p.aadhar);
  put("din", p.din);
  put("phone", p.phone);
  put("email", p.email);
  put("addressLine1", p.addressLine1);
  put("city", p.city);
  put("district", p.district);
  put("state", p.state);
  put("pincode", p.pincode);

  if (p.shareholdingPercent !== undefined) cleaned.shareholdingPercent = p.shareholdingPercent;

  return cleaned;
}

export function formStateToCreateInput(f: BorrowerFormState, promoters: Promoter[]): CreateBorrowerInput {
  const form = clearFieldsForOtherType(f);
  // "Related Person" is a commercial-sheet block; consumers never send it.
  const namedPromoters =
    form.borrowerType === "COMMERCIAL"
      ? promoters.filter((p) => p.name.trim() !== "").map(omitBlankPromoterFields)
      : [];

  return {
    borrowerType: form.borrowerType,
    borrowerCode: form.borrowerCode,
    name: form.name,
    groupName: form.groupName || undefined,
    constitution: form.constitution,
    email: form.email || undefined,
    phone: form.phone || undefined,
    alternatePhone: form.alternatePhone || undefined,
    addressLine1: form.addressLine1 || undefined,
    addressLine2: form.addressLine2 || undefined,
    city: form.city || undefined,
    district: form.district || undefined,
    state: form.state || undefined,
    pincode: form.pincode || undefined,
    pan: form.pan || undefined,
    gst: form.gst || undefined,
    cin: form.cin || undefined,
    aadhaar: form.aadhaar || undefined,
    dateOfIncorporation: form.dateOfIncorporation || undefined,
    natureOfBusiness: form.natureOfBusiness || undefined,
    gender: form.gender || undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    addressCategory: form.addressCategory || undefined,
    residenceCode: form.residenceCode || undefined,
    ownershipIndicator: form.ownershipIndicator || undefined,
    ckycNumber: form.ckycNumber || undefined,
    businessCategory: form.businessCategory || undefined,
    businessType: form.businessType || undefined,
    classOfActivity1: form.classOfActivity1 || undefined,
    applicantType: form.applicantType || undefined,
    internalRating: form.internalRating || undefined,
    ratingRemarks: form.ratingRemarks || undefined,
    notes: form.notes || undefined,
    promoters: namedPromoters.length > 0 ? namedPromoters : undefined,
  };
}

export function formStateToUpdateInput(f: BorrowerFormState): UpdateBorrowerInput {
  const form = clearFieldsForOtherType(f);

  return {
    borrowerType: form.borrowerType,
    borrowerCode: form.borrowerCode,
    name: form.name,
    groupName: form.groupName || null,
    constitution: form.constitution,
    email: form.email || null,
    phone: form.phone || null,
    alternatePhone: form.alternatePhone || null,
    addressLine1: form.addressLine1 || null,
    addressLine2: form.addressLine2 || null,
    city: form.city || null,
    district: form.district || null,
    state: form.state || null,
    pincode: form.pincode || null,
    pan: form.pan || null,
    gst: form.gst || null,
    cin: form.cin || null,
    aadhaar: form.aadhaar || null,
    dateOfIncorporation: form.dateOfIncorporation || null,
    natureOfBusiness: form.natureOfBusiness || null,
    gender: form.gender || null,
    dateOfBirth: form.dateOfBirth || null,
    addressCategory: form.addressCategory || null,
    residenceCode: form.residenceCode || null,
    ownershipIndicator: form.ownershipIndicator || null,
    ckycNumber: form.ckycNumber || null,
    businessCategory: form.businessCategory || null,
    businessType: form.businessType || null,
    classOfActivity1: form.classOfActivity1 || null,
    applicantType: form.applicantType || null,
    internalRating: form.internalRating || null,
    ratingRemarks: form.ratingRemarks || null,
    status: form.status,
    notes: form.notes || null,
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListBorrowersResult {
  data: Borrower[];
  meta: PaginationMeta;
}
