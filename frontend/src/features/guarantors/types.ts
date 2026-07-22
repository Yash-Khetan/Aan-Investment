export interface Guarantor {
  id: string;
  loanId: string;
  name: string;
  guaranteeType: string;
  pan: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  netWorth: string | null;
  createdAt: string | null;
}

export interface CreateGuarantorInput {
  name: string;
  guaranteeType: string;
  pan?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  netWorth?: number;
}

export interface UpdateGuarantorInput {
  name?: string;
  guaranteeType?: string;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  netWorth?: number | null;
}

export const EMPTY_GUARANTOR_INPUT: CreateGuarantorInput = {
  name: "",
  guaranteeType: "",
  pan: "",
  phone: "",
  email: "",
  netWorth: undefined,
};
