import { eq, and } from "drizzle-orm";
import { db, interestConfigs, interestRules, penalInterestRules } from "../../db";

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
  interestBasis: string;
  ruleType?: string;
  effectiveFrom: string;
  remarks?: string;
  customFormula?: string;
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
        interestBasis: input.interestBasis as any,
        ruleType: (input.ruleType ?? "NORMAL") as any,
        effectiveFrom: input.effectiveFrom,
        isCurrent: true,
        remarks: input.remarks,
        customFormula: input.customFormula,
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