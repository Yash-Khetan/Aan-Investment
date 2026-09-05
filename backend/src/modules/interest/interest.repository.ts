import { eq, and, gt, lte, desc, asc } from "drizzle-orm";
import {
  db,
  interestConfigs,
  interestRules,
  penalInterestRules,
  loans,
  loanTranches,
  payments,
  paymentAllocations,
} from "../../db";
import type { PrincipalLedgerEvent } from "./interest.types";

/**
 * Fetches the currently active interest configuration for a loan.
 * Assumes exactly one row has isCurrent = true per loan at any time —
 * this invariant must be maintained by whichever service creates/revises configs.
 */
export async function getCurrentInterestConfig(loanId: string) {
  const rows = await db
    .select()
    .from(interestConfigs)
    .where(and(eq(interestConfigs.loanId, loanId), eq(interestConfigs.isCurrent, true)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * The interest configuration that was in effect on a given date — the
 * revision with the latest effectiveFrom on or before it, most recently
 * created first when two revisions share a date.
 *
 * This is what gives a configuration change its effective point: a period
 * being calculated resolves the revision that governed it, so a change saved
 * today cannot retroactively alter how an earlier period is calculated.
 *
 * Falls back to the loan's earliest revision for a date preceding all of
 * them (a period that predates the loan's first configuration is calculated
 * under that first configuration, not under none), and returns null only
 * when the loan has no interest configuration at all.
 */
export async function getInterestConfigEffectiveOn(loanId: string, isoDate: string) {
  const rows = await db
    .select()
    .from(interestConfigs)
    .where(and(eq(interestConfigs.loanId, loanId), lte(interestConfigs.effectiveFrom, isoDate)))
    .orderBy(desc(interestConfigs.effectiveFrom), desc(interestConfigs.createdAt))
    .limit(1);

  if (rows[0]) return rows[0];

  const earliest = await db
    .select()
    .from(interestConfigs)
    .where(eq(interestConfigs.loanId, loanId))
    .orderBy(asc(interestConfigs.effectiveFrom), asc(interestConfigs.createdAt))
    .limit(1);

  return earliest[0] ?? null;
}

/**
 * Fetches all step-up/step-down/event-based rules attached to a given
 * interest config. These feed directly into rateResolver.
 */
export async function getInterestRulesForConfig(interestConfigId: string) {
  return db
    .select()
    .from(interestRules)
    .where(eq(interestRules.interestConfigId, interestConfigId));
}

/**
 * Fetches the currently active penal interest rule for a loan.
 */
export async function getCurrentPenalRule(loanId: string) {
  const rows = await db
    .select()
    .from(penalInterestRules)
    .where(and(eq(penalInterestRules.loanId, loanId), eq(penalInterestRules.isCurrent, true)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Creates a new interest config revision for a loan. Marks the previous
 * current config (if any) as superseded, setting its effectiveTo and
 * isCurrent = false, in the same logical operation.
 *
 * Callers are responsible for validating that `effectiveFrom` doesn't
 * precede the loan's existing config history in a way that breaks
 * chronological ordering.
 */
export async function createInterestConfigRevision(input: {
  loanId: string;
  annualRate: string;
  tdsRatePercent: string;
  interestBasis: string;
  ruleType?: string;
  effectiveFrom: string;
  remarks?: string;
  customFormula?: string;
  includeOpeningClosingDays?: boolean;
  calculationMethod?: string;
}) {
  return db.transaction(async (tx) => {
    const previous = await tx
      .select()
      .from(interestConfigs)
      .where(and(eq(interestConfigs.loanId, input.loanId), eq(interestConfigs.isCurrent, true)))
      .limit(1);

    if (previous[0]) {
      await tx
        .update(interestConfigs)
        .set({ isCurrent: false, effectiveTo: input.effectiveFrom })
        .where(eq(interestConfigs.id, previous[0].id));
    }

    const [created] = await tx
      .insert(interestConfigs)
      .values({
        loanId: input.loanId,
        annualRate: input.annualRate,
        tdsRatePercent: input.tdsRatePercent,
        interestBasis: input.interestBasis as any,
        ruleType: (input.ruleType ?? "NORMAL") as any,
        effectiveFrom: input.effectiveFrom,
        isCurrent: true,
        remarks: input.remarks,
        customFormula: input.customFormula,
        includeOpeningClosingDays: input.includeOpeningClosingDays ?? false,
        calculationMethod: (input.calculationMethod ?? "SIMPLE_INTEREST") as any,
      })
      .returning();

    return created;
  });
}


export async function createInterestRule(input: {
  interestConfigId: string;
  fromMonth?: number;
  toMonth?: number;
  rate: string;
  triggerEvent?: string;
  remarks?: string;
}) {
  const [created] = await db
    .insert(interestRules)
    .values({
      interestConfigId: input.interestConfigId,
      fromMonth: input.fromMonth,
      toMonth: input.toMonth,
      rate: input.rate,
      triggerEvent: input.triggerEvent,
      remarks: input.remarks,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create interest rule.");
  }

  return created;
}

export async function deleteInterestRule(ruleId: string) {
  await db.delete(interestRules).where(eq(interestRules.id, ruleId));
}

export async function createPenalRule(input: {
  loanId: string;
  penalType: string;
  penalRate?: string;
  penalAmount?: string;
  penalBase?: string;
  gracePeriodDays?: number;
  remarks?: string;
}) {
  return db.transaction(async (tx) => {
    const previous = await tx
      .select()
      .from(penalInterestRules)
      .where(and(eq(penalInterestRules.loanId, input.loanId), eq(penalInterestRules.isCurrent, true)))
      .limit(1);

    if (previous[0]) {
      await tx
        .update(penalInterestRules)
        .set({ isCurrent: false })
        .where(eq(penalInterestRules.id, previous[0].id));
    }

    const [created] = await tx
      .insert(penalInterestRules)
      .values({
        loanId: input.loanId,
        penalType: input.penalType as any,
        penalRate: input.penalRate,
        penalAmount: input.penalAmount,
        penalBase: (input.penalBase ?? "OVERDUE_INSTALLMENT_ONLY") as any,
        gracePeriodDays: input.gracePeriodDays ?? 0,
        isCurrent: true,
        remarks: input.remarks,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create penal rule.");
    }

    return created;
  });
}

export async function getPenalRulesForLoan(loanId: string) {
  return db
    .select()
    .from(penalInterestRules)
    .where(eq(penalInterestRules.loanId, loanId));
}

/**
 * The loan's own Interest and TDS rates, as the Loan module holds them. The
 * Loan module is where an operator edits these; a configuration revision
 * snapshots them so each period keeps what it was calculated under.
 */
export async function getLoanRates(
  loanId: string
): Promise<{ interestRate: string; tdsRatePercent: string } | null> {
  const rows = await db
    .select({ interestRate: loans.interestRate, tdsRatePercent: loans.tdsRatePercent })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * The loan's original principal for the Simple Interest Method — the
 * cumulative amount actually disbursed to date (never reduced by
 * repayments), falling back to the sanctioned amount if nothing has been
 * disbursed yet.
 */
export async function getLoanOriginalPrincipal(loanId: string): Promise<number> {
  const rows = await db
    .select({ disbursedAmount: loans.disbursedAmount, sanctionedAmount: loans.sanctionedAmount })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  const loan = rows[0];
  if (!loan) return 0;

  const disbursed = Number(loan.disbursedAmount ?? 0);
  return disbursed > 0 ? disbursed : Number(loan.sanctionedAmount ?? 0);
}

/**
 * Every event that changed the loan's outstanding principal, oldest first —
 * disbursement tranches (positive) and principal repayments (negative). Feeds
 * the Running Balance Method's day-by-day walk.
 */
export async function getPrincipalLedgerEvents(loanId: string): Promise<PrincipalLedgerEvent[]> {
  const tranches = await db
    .select({ disbursementDate: loanTranches.disbursementDate, amount: loanTranches.amount })
    .from(loanTranches)
    .where(eq(loanTranches.loanId, loanId));

  const repayments = await db
    .select({ paymentDate: payments.paymentDate, principalApplied: paymentAllocations.principalApplied })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(and(eq(payments.loanId, loanId), gt(paymentAllocations.principalApplied, "0")));

  const events: PrincipalLedgerEvent[] = [
    ...tranches
      .filter((t) => t.disbursementDate)
      .map((t) => ({ date: new Date(t.disbursementDate as string), delta: Number(t.amount) })),
    ...repayments.map((r) => ({ date: new Date(r.paymentDate), delta: -Number(r.principalApplied) })),
  ];

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}