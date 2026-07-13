import { db, journalEntries, journalEntryLines } from "../../db";
import { ACCOUNTING_ACCOUNT_MAP, ACCOUNTING_ACCOUNT_CODES } from "./accounting.constants";
import { CreateJournalEntryInput } from "./accounting.types";

/**
 * Generates a simple sequential-looking entry number. Not guaranteed
 * globally unique under concurrent writes (no DB sequence backing it) —
 * acceptable for V1 given low transaction volume (SRS: ~30-40 active
 * loan accounts, 2-5 users), but worth revisiting if volume grows.
 */
function generateEntryNumber(): string {
  const now = new Date();
  const stamp = now.getTime().toString(36).toUpperCase();
  return `JE-${stamp}`;
}

/**
 * Creates a balanced double-entry journal entry (one debit line, one
 * credit line, equal amounts) for a given accounting event. Runs as a
 * transaction since the header row and both lines must succeed together.
 */
export async function createJournalEntry(input: CreateJournalEntryInput) {
  const accounts = ACCOUNTING_ACCOUNT_MAP[input.entryType];
  if (!accounts) {
    throw new Error(`No account mapping configured for entry type: ${input.entryType}`);
  }

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        entryNumber: generateEntryNumber(),
        loanId: input.loanId,
        paymentId: input.paymentId,
        entryType: input.entryType as any,
        entryDate: input.entryDate,
        narration: input.narration,
        isPosted: true,
        isExported: false,
      })
      .returning();

    if (!entry) {
      throw new Error("Failed to create journal entry header.");
    }

    await tx.insert(journalEntryLines).values([
      {
        journalEntryId: entry.id,
        accountCode: ACCOUNTING_ACCOUNT_CODES[accounts.debitAccount] ?? "0000",
        accountName: accounts.debitAccount,
        debitAmount: String(input.amount),
        creditAmount: "0",
        narration: input.narration,
      },
      {
        journalEntryId: entry.id,
        accountCode: ACCOUNTING_ACCOUNT_CODES[accounts.creditAccount] ?? "0000",
        accountName: accounts.creditAccount,
        debitAmount: "0",
        creditAmount: String(input.amount),
        narration: input.narration,
      },
    ]);

    return entry;
  });
}

export async function getJournalEntriesForLoan(loanId: string) {
  const { eq } = await import("drizzle-orm");
  return db.select().from(journalEntries).where(eq(journalEntries.loanId, loanId));
}