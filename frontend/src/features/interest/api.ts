import { apiRequest } from "../../lib/api";
import type {
  CalculateInterestInput,
  CalculateInterestResult,
  CreateInterestConfigInput,
  CreateInterestRuleInput,
  CreatePenalRuleInput,
  InterestConfig,
  InterestRule,
  PenalInterestRule,
} from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function createInterestConfig(input: CreateInterestConfigInput): Promise<InterestConfig> {
  const res = await apiRequest<Envelope<InterestConfig>>("/interest-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getInterestConfig(loanId: string): Promise<InterestConfig> {
  const res = await apiRequest<Envelope<InterestConfig>>(`/interest-rules/${loanId}`);
  return res.data;
}

export async function calculateInterest(
  loanId: string,
  input: CalculateInterestInput,
): Promise<CalculateInterestResult> {
  const res = await apiRequest<Envelope<CalculateInterestResult>>(`/interest-rules/${loanId}/calculate`, {
    method: "POST",
    body: JSON.stringify({ ...input, installments: [] }),
  });
  return res.data;
}

export async function createInterestRule(input: CreateInterestRuleInput): Promise<InterestRule> {
  const res = await apiRequest<Envelope<InterestRule>>("/interest-rules/rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteInterestRule(ruleId: string): Promise<void> {
  await apiRequest<void>(`/interest-rules/rules/${ruleId}`, { method: "DELETE" });
}

export async function createPenalRule(input: CreatePenalRuleInput): Promise<PenalInterestRule> {
  const res = await apiRequest<Envelope<PenalInterestRule>>("/interest-rules/penal-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function listInterestRules(interestConfigId: string): Promise<InterestRule[]> {
  const res = await apiRequest<Envelope<InterestRule[]>>(`/interest-rules/rules/${interestConfigId}`);
  return res.data;
}

export async function listPenalRules(loanId: string): Promise<PenalInterestRule[]> {
  const res = await apiRequest<Envelope<PenalInterestRule[]>>(`/interest-rules/penal-rules/${loanId}`);
  return res.data;
}
