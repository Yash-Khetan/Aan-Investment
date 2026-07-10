import { apiRequest } from "../../lib/api";
import type { BorrowerLookup, LoanLookup } from "./types";

export function getLoanLookup(): Promise<LoanLookup[]> {
  return apiRequest<LoanLookup[]>("/lookup/loans");
}

export function getBorrowerLookup(): Promise<BorrowerLookup[]> {
  return apiRequest<BorrowerLookup[]>("/lookup/borrowers");
}
