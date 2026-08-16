import { evaluate } from "mathjs";

export type FormulaResult = { value: number } | { error: string };

/**
 * Evaluates a user-authored formula (e.g. "debit * interest") against a scope of named values
 * (saved row parameters plus the row's own numeric fields). Uses mathjs's sandboxed `evaluate`
 * instead of `eval`/`Function`, so the formula text can never execute arbitrary JS.
 *
 * NOTE: this is the piece slated to move server-side (POST to the future Python microservice) —
 * keep its signature (formula + scope in, result out) stable so callers don't need to change.
 */
export function evaluateFormula(formula: string, scope: Record<string, number>): FormulaResult {
  const trimmed = formula.trim();
  if (trimmed === "") {
    return { error: "Formula is empty." };
  }
  try {
    const result = evaluate(trimmed, scope);
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { error: "Formula did not evaluate to a number." };
    }
    return { value: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid formula." };
  }
}

/** Builds the scope of built-in row fields a formula can reference, alongside saved parameters. */
export function buildRowScope(row: {
  debit: number | null;
  credit: number | null;
  balance: number | null;
}): Record<string, number> {
  return {
    debit: row.debit ?? 0,
    credit: row.credit ?? 0,
    balance: row.balance ?? 0,
    principal: row.debit ?? row.credit ?? 0,
  };
}
