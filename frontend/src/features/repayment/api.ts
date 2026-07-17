import { apiRequest } from "../../lib/api";
import type { GenerateScheduleInput, RepaymentSchedule, ScheduleWithInstallments } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function generateSchedule(input: GenerateScheduleInput): Promise<RepaymentSchedule> {
  const res = await apiRequest<Envelope<RepaymentSchedule>>("/repayment-schedules", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getSchedule(loanId: string): Promise<ScheduleWithInstallments> {
  const res = await apiRequest<Envelope<ScheduleWithInstallments>>(`/repayment-schedules/${loanId}`);
  return res.data;
}
