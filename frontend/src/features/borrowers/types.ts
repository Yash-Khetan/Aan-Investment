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
] as const;

export const BORROWER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export interface Promoter {
  id?: string;
  name: string;
  designation?: string;
  pan?: string;
  aadhar?: string;
  din?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  shareholdingPercent?: number;
}

export interface Borrower {
  id: string;
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
  state: string | null;
  pincode: string | null;
  pan: string | null;
  gst: string | null;
  cin: string | null;
  dateOfIncorporation: string | null;
  natureOfBusiness: string | null;
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
  state?: string;
  pincode?: string;
  pan?: string;
  gst?: string;
  cin?: string;
  dateOfIncorporation?: string;
  natureOfBusiness?: string;
  internalRating?: string;
  ratingRemarks?: string;
  notes?: string;
  promoters?: Promoter[];
}

/** Master-field update payload. Every field is sent; nullable ones clear on empty string. */
export interface UpdateBorrowerInput {
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
  state: string | null;
  pincode: string | null;
  pan: string | null;
  gst: string | null;
  cin: string | null;
  dateOfIncorporation: string | null;
  natureOfBusiness: string | null;
  internalRating: string | null;
  ratingRemarks: string | null;
  status: string;
  notes: string | null;
}

/** Controlled-input-friendly form state: every field is always a defined string. */
export interface BorrowerFormState {
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
  state: string;
  pincode: string;
  pan: string;
  gst: string;
  cin: string;
  dateOfIncorporation: string;
  natureOfBusiness: string;
  internalRating: string;
  ratingRemarks: string;
  status: string;
  notes: string;
}

export const EMPTY_BORROWER_FORM: BorrowerFormState = {
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
  state: "",
  pincode: "",
  pan: "",
  gst: "",
  cin: "",
  dateOfIncorporation: "",
  natureOfBusiness: "",
  internalRating: "",
  ratingRemarks: "",
  status: "ACTIVE",
  notes: "",
};

export function borrowerToFormState(b: Borrower): BorrowerFormState {
  return {
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
    state: b.state ?? "",
    pincode: b.pincode ?? "",
    pan: b.pan ?? "",
    gst: b.gst ?? "",
    cin: b.cin ?? "",
    dateOfIncorporation: b.dateOfIncorporation ?? "",
    natureOfBusiness: b.natureOfBusiness ?? "",
    internalRating: b.internalRating ?? "",
    ratingRemarks: b.ratingRemarks ?? "",
    status: b.status ?? "ACTIVE",
    notes: b.notes ?? "",
  };
}

export function formStateToCreateInput(f: BorrowerFormState, promoters: Promoter[]): CreateBorrowerInput {
  return {
    borrowerCode: f.borrowerCode,
    name: f.name,
    groupName: f.groupName || undefined,
    constitution: f.constitution,
    email: f.email || undefined,
    phone: f.phone || undefined,
    alternatePhone: f.alternatePhone || undefined,
    addressLine1: f.addressLine1 || undefined,
    addressLine2: f.addressLine2 || undefined,
    city: f.city || undefined,
    state: f.state || undefined,
    pincode: f.pincode || undefined,
    pan: f.pan || undefined,
    gst: f.gst || undefined,
    cin: f.cin || undefined,
    dateOfIncorporation: f.dateOfIncorporation || undefined,
    natureOfBusiness: f.natureOfBusiness || undefined,
    internalRating: f.internalRating || undefined,
    ratingRemarks: f.ratingRemarks || undefined,
    notes: f.notes || undefined,
    promoters: promoters.filter((p) => p.name.trim() !== "").length > 0 ? promoters.filter((p) => p.name.trim() !== "") : undefined,
  };
}

export function formStateToUpdateInput(f: BorrowerFormState): UpdateBorrowerInput {
  return {
    borrowerCode: f.borrowerCode,
    name: f.name,
    groupName: f.groupName || null,
    constitution: f.constitution,
    email: f.email || null,
    phone: f.phone || null,
    alternatePhone: f.alternatePhone || null,
    addressLine1: f.addressLine1 || null,
    addressLine2: f.addressLine2 || null,
    city: f.city || null,
    state: f.state || null,
    pincode: f.pincode || null,
    pan: f.pan || null,
    gst: f.gst || null,
    cin: f.cin || null,
    dateOfIncorporation: f.dateOfIncorporation || null,
    natureOfBusiness: f.natureOfBusiness || null,
    internalRating: f.internalRating || null,
    ratingRemarks: f.ratingRemarks || null,
    status: f.status,
    notes: f.notes || null,
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
