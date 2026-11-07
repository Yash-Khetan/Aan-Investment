export type ChangeRequestEntityType =
  | "LOAN"
  | "COLLATERAL"
  | "COLLATERAL_INSURANCE"
  | "LEDGER_ENTRY"
  | "LEDGER_IMPORT";

export type ChangeRequestAction = "CREATE" | "UPDATE" | "DELETE";

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ChangeRequest {
  id: string;
  entityType: ChangeRequestEntityType;
  entityId: string | null;
  action: ChangeRequestAction;
  payload: Record<string, unknown> | null;
  previousValues: Record<string, unknown> | null;
  loanId: string | null;
  requestedBy: string | null;
  requestedAt: string;
  status: ChangeRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface ListChangeRequestsFilters {
  status?: ChangeRequestStatus;
  entityType?: ChangeRequestEntityType;
  loanId?: string;
  page?: number;
  limit?: number;
}

export const ENTITY_TYPE_LABELS: Record<ChangeRequestEntityType, string> = {
  LOAN: "Loan",
  COLLATERAL: "Collateral",
  COLLATERAL_INSURANCE: "Collateral insurance",
  LEDGER_ENTRY: "Ledger entry",
  LEDGER_IMPORT: "Ledger import",
};
