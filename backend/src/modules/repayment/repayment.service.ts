import { repaymentStrategyRegistry } from "./strategies";
import {
  createScheduleRevision,
  getCurrentSchedule,
  getInstallmentsForSchedule,
  getLoanForSchedule,
  hasPaymentsAgainstSchedule,
} from "./repayment.repository";
import { getCurrentInterestConfig } from "../interest/interest.repository";
import { GenerateScheduleInput, RepaymentType } from "./repayment.types";

function diffInMonths(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

/**
 * Assembles the strategy input entirely from the loan + its current interest
 * config — nothing is taken from the caller. Throws a clear error if either
 * doesn't have enough information yet (no interest config set, or missing
 * disbursement/maturity dates).
 */
async function buildScheduleInput(loanId: string): Promise<GenerateScheduleInput> {
  const loan = await getLoanForSchedule(loanId);
  if (!loan) {
    throw new Error(`Loan ${loanId} not found.`);
  }
  if (!loan.firstDisbursementDate || !loan.maturityDate) {
    throw new Error(
      `Loan ${loanId} needs both a first disbursement date and a maturity date before a repayment schedule can be generated.`
    );
  }

  const interestConfig = await getCurrentInterestConfig(loanId);
  if (!interestConfig) {
    throw new Error(`Loan ${loanId} needs an interest configuration before a repayment schedule can be generated.`);
  }

  const disbursementDate = new Date(loan.firstDisbursementDate);
  const maturityDate = new Date(loan.maturityDate);
  const tenureMonths = diffInMonths(disbursementDate, maturityDate);

  const principal = Number(loan.disbursedAmount) > 0 ? Number(loan.disbursedAmount) : Number(loan.sanctionedAmount);

  return {
    loanId,
    principal,
    annualRate: Number(interestConfig.annualRate),
    interestBasis: interestConfig.interestBasis,
    calculationMethod: interestConfig.calculationMethod ?? "SIMPLE_INTEREST",
    includeOpeningClosingDays: interestConfig.includeOpeningClosingDays ?? false,
    customFormula: interestConfig.customFormula,
    tenureMonths,
    moratoriumMonths: loan.moratoriumMonths ?? 0,
    disbursementDate,
    repaymentType: loan.repaymentType as RepaymentType,
  };
}

/**
 * Generates a new repayment schedule for a loan — entirely from the loan's
 * own details and its current interest configuration — and persists it as a
 * new version, superseding any existing current schedule.
 */
export async function generateAndSaveSchedule(loanId: string, remarks?: string) {
  const input = await buildScheduleInput(loanId);

  const strategy = repaymentStrategyRegistry[input.repaymentType];
  if (!strategy) {
    throw new Error(`No repayment strategy registered for type: ${input.repaymentType}`);
  }

  const generatedInstallments = strategy.generate(input);

  return createScheduleRevision({
    loanId: input.loanId,
    generatedInstallments,
    remarks,
    generationSnapshot: {
      principal: input.principal,
      annualRate: input.annualRate,
      interestBasis: input.interestBasis,
      calculationMethod: input.calculationMethod,
      tenureMonths: input.tenureMonths,
      disbursementDate: input.disbursementDate,
    },
  });
}

/**
 * Called after a loan or interest-config change. Generates a first schedule
 * if none exists yet; if one exists and the loan/interest details have moved
 * on since it was generated, regenerates automatically — but ONLY when no
 * payment has been recorded against it yet. Once a payment exists, the
 * schedule is left alone (regenerating would orphan the payment-to-
 * installment link) and the mismatch surfaces to the frontend via the
 * `isStale` flag on GET instead, requiring an explicit manual regenerate.
 *
 * Fails silently — a hiccup here must never block the loan/interest save
 * that triggered it.
 */
export async function syncRepaymentSchedule(loanId: string): Promise<void> {
  try {
    const schedule = await getCurrentSchedule(loanId);

    if (!schedule) {
      await generateAndSaveSchedule(loanId);
      return;
    }

    const input = await buildScheduleInput(loanId);
    if (!isStale(schedule, input)) return;

    if (await hasPaymentsAgainstSchedule(schedule.id)) return;

    await generateAndSaveSchedule(loanId);
  } catch {
    // Prerequisites not met yet (no interest config, missing dates, etc.) —
    // nothing to do until the loan/interest setup is complete.
  }
}

/** Compares a schedule's generation snapshot against the loan/interest config's current values. */
function isStale(
  schedule: { generatedPrincipal: string | null; generatedAnnualRate: string | null; generatedInterestBasis: string | null; generatedCalculationMethod: string | null; generatedTenureMonths: number | null; generatedDisbursementDate: string | null },
  current: GenerateScheduleInput
): boolean {
  return (
    Number(schedule.generatedPrincipal ?? 0) !== current.principal ||
    Number(schedule.generatedAnnualRate ?? 0) !== current.annualRate ||
    schedule.generatedInterestBasis !== current.interestBasis ||
    schedule.generatedCalculationMethod !== current.calculationMethod ||
    schedule.generatedTenureMonths !== current.tenureMonths ||
    schedule.generatedDisbursementDate !== current.disbursementDate.toISOString().slice(0, 10)
  );
}

/**
 * Fetches the current schedule for a loan along with its installments, and
 * whether it's stale (loan/interest details changed since generation, but
 * couldn't auto-regenerate because payments already exist against it).
 */
export async function getCurrentScheduleWithInstallments(loanId: string) {
  const schedule = await getCurrentSchedule(loanId);
  if (!schedule) return null;

  const installmentRows = await getInstallmentsForSchedule(schedule.id);

  let stale = false;
  try {
    const input = await buildScheduleInput(loanId);
    stale = isStale(schedule, input);
  } catch {
    // Can't tell without a valid loan/interest config — not stale, just unknown.
  }

  return { schedule, installments: installmentRows, isStale: stale };
}
