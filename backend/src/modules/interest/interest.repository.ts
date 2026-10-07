import { eq, and, lte, desc, asc, inArray } from "drizzle-orm";
import { db, interestConfigs } from "../../db";
import type { InterestBasis } from "./interest.types";

/** Either the top-level `db` or a transaction handle from `db.transaction(...)`. */
type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/**
 * The interest configuration revision currently in effect for a loan — the
 * one with isCurrent = true. Every loan gets one in the same transaction that
 * creates it, so this is null only for a loan id that does not exist.
 */
export async function getCurrentInterestConfig(loanId: string) {
  const rows = await db
    .select()
    .from(interestConfigs)
    .where(and(eq(interestConfigs.loanId, loanId), eq(interestConfigs.isCurrent, true)))
    .limit(1);

  return rows[0] ?? null;
}

/** The current interest and TDS rate of several loans in one read, keyed by loan id. */
export async function getCurrentRates(
  loanIds: string[]
): Promise<Map<string, { interestRate: string; tdsRatePercent: string }>> {
  const result = new Map<string, { interestRate: string; tdsRatePercent: string }>();
  if (loanIds.length === 0) return result;

  const rows = await db
    .select({
      loanId: interestConfigs.loanId,
      annualRate: interestConfigs.annualRate,
      tdsRatePercent: interestConfigs.tdsRatePercent,
    })
    .from(interestConfigs)
    .where(and(inArray(interestConfigs.loanId, loanIds), eq(interestConfigs.isCurrent, true)));

  for (const r of rows) result.set(r.loanId, { interestRate: r.annualRate, tdsRatePercent: r.tdsRatePercent });
  return result;
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
 * Creates a new interest config revision for a loan, marking the previous
 * current revision (if any) superseded — effectiveTo set, isCurrent false —
 * in the same transaction. Runs inside `tx` when one is given, so a loan and
 * its first revision are written together or not at all.
 */
export async function createInterestConfigRevision(
  input: {
    loanId: string;
    annualRate: string;
    tdsRatePercent: string;
    interestBasis: InterestBasis;
    effectiveFrom: string;
    remarks?: string;
    includeOpeningClosingDays: boolean;
  },
  tx?: DbOrTx
) {
  const write = async (t: DbOrTx) => {
    const previous = await t
      .select()
      .from(interestConfigs)
      .where(and(eq(interestConfigs.loanId, input.loanId), eq(interestConfigs.isCurrent, true)))
      .limit(1);

    if (previous[0]) {
      await t
        .update(interestConfigs)
        .set({ isCurrent: false, effectiveTo: input.effectiveFrom })
        .where(eq(interestConfigs.id, previous[0].id));
    }

    const [created] = await t
      .insert(interestConfigs)
      .values({
        loanId: input.loanId,
        annualRate: input.annualRate,
        tdsRatePercent: input.tdsRatePercent,
        interestBasis: input.interestBasis,
        effectiveFrom: input.effectiveFrom,
        isCurrent: true,
        remarks: input.remarks,
        includeOpeningClosingDays: input.includeOpeningClosingDays,
      })
      .returning();

    return created!;
  };

  return tx ? write(tx) : db.transaction(write);
}
