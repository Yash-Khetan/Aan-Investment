import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import { applyMigrationFiles, testClient } from "../../test/testDb";

/**
 * What 0003 does to a database that already holds ledger entries.
 *
 * The lock column has to be backfilled from provenance, and only from
 * provenance: an entry an import posted becomes locked, and a hand-recorded
 * or ledger-posted one does not. Nothing may be lost on the way.
 *
 * The migrations are applied by file, split on the same
 * `--> statement-breakpoint` marker the real migrator splits on — 0000 to 0002
 * first, so the rows below exist in a pre-0003 database exactly as a live one
 * would hold them, and only then 0003.
 */

const LOAN_ID = "11111111-1111-4111-8111-111111111111";
const BORROWER_ID = "22222222-2222-4222-8222-222222222222";
const IMPORT_ID = "33333333-3333-4333-8333-333333333333";

const IMPORTED_AT = "2024-02-01T10:30:00+00";

async function rows<T>(sql: string): Promise<T[]> {
  const result = await testClient.query<T>(sql);
  return result.rows;
}

describe("0003_ledger_entry_locking_and_audit_logs", () => {
  beforeAll(async () => {
    await applyMigrationFiles(["0000_baseline", "0001_identity_scans_in_documents_and_scheduled_entries", "0002_ledger_imports"]);

    await testClient.exec(`
      INSERT INTO borrowers (id, borrower_type, borrower_code, name, constitution)
      VALUES ('${BORROWER_ID}', 'COMMERCIAL', 'BRW-MIG', 'Migration Borrower', 'PRIVATE_LIMITED');

      INSERT INTO loans (id, loan_account_number, borrower_id, loan_type, repayment_type, sanctioned_amount, tenure_months)
      VALUES ('${LOAN_ID}', 'LN-MIG', '${BORROWER_ID}', 'UNSECURED', 'BULLET', '1000000.00', 12);

      INSERT INTO ledger_imports (id, loan_id, file_name, sheet_name, row_count, first_entry_date, last_entry_date, last_interest_month, closing_balance, created_at)
      VALUES ('${IMPORT_ID}', '${LOAN_ID}', 'history.xlsx', 'Loan A', 2, '2024-01-01', '2024-01-31', '2024-01-01', '1015534.24', '${IMPORTED_AT}');

      INSERT INTO ledger_entries (loan_id, entry_date, vch_type, vch_no, debit, credit, narration, source, import_id, is_system_generated)
      VALUES
        ('${LOAN_ID}', '2024-01-01', 'PAYMENT', '1', '1000000.00', NULL, 'Imported disbursement', 'IMPORT', '${IMPORT_ID}', false),
        ('${LOAN_ID}', '2024-01-31', 'JOURNAL_INTEREST', '2', '17260.27', NULL, 'Being Interest @ 21%', 'IMPORT', '${IMPORT_ID}', false),
        ('${LOAN_ID}', '2024-03-05', 'RECEIPT', '3', NULL, '50000.00', 'Hand-recorded receipt', 'MANUAL', NULL, false),
        ('${LOAN_ID}', '2024-02-29', 'JOURNAL_INTEREST', '4', '18000.00', NULL, 'Being Interest @ 21%', 'SYSTEM', NULL, true);
    `);

    await applyMigrationFiles(["0003_ledger_entry_locking_and_audit_logs"]);
  });

  it("keeps every existing entry, with its figures untouched", async () => {
    const entries = await rows<{ vch_no: string; debit: string | null; credit: string | null; narration: string }>(
      `SELECT vch_no, debit, credit, narration FROM ledger_entries WHERE loan_id = '${LOAN_ID}' ORDER BY vch_no`,
    );

    expect(entries).toHaveLength(4);
    expect(entries.map((e) => [e.vch_no, e.debit, e.credit])).toEqual([
      ["1", "1000000.00", null],
      ["2", "17260.27", null],
      ["3", null, "50000.00"],
      ["4", "18000.00", null],
    ]);
  });

  it("locks the entries an import posted, dated by that import", async () => {
    // Compared in SQL, so the assertion is about the stored timestamp itself
    // rather than about how a client happens to parse it back.
    const locked = await rows<{ vch_no: string; is_locked: boolean; dated_by_import: boolean }>(
      `SELECT vch_no,
              locked_at IS NOT NULL AS is_locked,
              locked_at = (SELECT created_at FROM ledger_imports WHERE id = '${IMPORT_ID}') AS dated_by_import
       FROM ledger_entries
       WHERE loan_id = '${LOAN_ID}' AND source = 'IMPORT'
       ORDER BY vch_no`,
    );

    expect(locked).toHaveLength(2);
    expect(locked.every((e) => e.is_locked)).toBe(true);
    expect(locked.every((e) => e.dated_by_import)).toBe(true);
  });

  it("leaves hand-recorded and ledger-posted entries unlocked", async () => {
    const unlocked = await rows<{ vch_no: string; source: string; locked_at: string | null }>(
      `SELECT vch_no, source, locked_at FROM ledger_entries WHERE loan_id = '${LOAN_ID}' AND source <> 'IMPORT' ORDER BY vch_no`,
    );

    expect(unlocked.map((e) => e.source)).toEqual(["MANUAL", "SYSTEM"]);
    expect(unlocked.every((e) => e.locked_at === null)).toBe(true);
  });

  it("adds an empty audit trail", async () => {
    const columns = await rows<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY column_name`,
    );
    expect(columns.map((c) => c.column_name)).toEqual([
      "action",
      "created_at",
      "entity_id",
      "entity_type",
      "id",
      "ip_address",
      "new_values",
      "old_values",
      "user_agent",
      "user_id",
    ]);

    const [count] = await rows<{ total: number }>(`SELECT count(*)::int AS total FROM audit_logs`);
    expect(count!.total).toBe(0);
  });

  /**
   * That the project's own migrator applies all four files to an empty
   * database is covered by modules/ledger/ledgerLocking.test.ts, which starts
   * every run from `migrateTestDb()`. What matters here is that 0003 is the
   * last entry in the journal the migrator reads, so `npm run db:migrate`
   * picks it up in order.
   */
  it("is the last migration in the journal", async () => {
    const journal = JSON.parse(await readFile("src/db/migrations/meta/_journal.json", "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const last = journal.entries[journal.entries.length - 1]!;

    expect(last.tag).toBe("0003_ledger_entry_locking_and_audit_logs");
    expect(last.idx).toBe(3);
  });
});
