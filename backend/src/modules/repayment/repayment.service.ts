import { repaymentStrategyRegistry } from "./strategies";
import { createScheduleRevision, getCurrentSchedule, getInstallmentsForSchedule } from "./repayment.repository";
import { GenerateScheduleInput } from "./repayment.types";

/**
 * Generates a new repayment schedule for a loan and persists it as a new
 * version, superseding any existing current schedule.
 */
export async function generateAndSaveSchedule(input: GenerateScheduleInput, remarks?: string) {
  const strategy = repaymentStrategyRegistry[input.repaymentType];
  if (!strategy) {
    throw new Error(`No repayment strategy registered for type: ${input.repaymentType}`);
  }

  const generatedInstallments = strategy.generate(input);

  return createScheduleRevision({
    loanId: input.loanId,
    generatedInstallments,
    remarks,
  });
}

/**
 * Fetches the current schedule for a loan along with its installments.
 */
export async function getCurrentScheduleWithInstallments(loanId: string) {
  const schedule = await getCurrentSchedule(loanId);
  if (!schedule) return null;

  const installmentRows = await getInstallmentsForSchedule(schedule.id);
  return { schedule, installments: installmentRows };
}