import { apiRequest } from "../../lib/api";
import type {
  CollateralRecord,
  CreateCollateralInput,
  LtvResult,
  UpdateInsuranceInput,
  UpdateValuationInput,
} from "./types";

export function getLoanCollaterals(loanId: string): Promise<CollateralRecord[]> {
  return apiRequest<CollateralRecord[]>(`/collateral/loan/${loanId}`);
}

export function createCollateral(input: CreateCollateralInput): Promise<CollateralRecord> {
  return apiRequest<CollateralRecord>("/collateral", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateValuation(id: string, input: UpdateValuationInput): Promise<CollateralRecord> {
  return apiRequest<CollateralRecord>(`/collateral/${id}/valuation`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateInsurance(id: string, input: UpdateInsuranceInput) {
  return apiRequest(`/collateral/${id}/insurance`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getCollateralLtv(id: string): Promise<LtvResult> {
  return apiRequest<LtvResult>(`/collateral/${id}/ltv`);
}

export function deleteCollateral(id: string): Promise<void> {
  return apiRequest<void>(`/collateral/${id}`, { method: "DELETE" });
}
