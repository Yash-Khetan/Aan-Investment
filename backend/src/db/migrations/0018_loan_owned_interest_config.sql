-- Makes the Loan module the source of the current interest configuration.
--
-- interest_configs gains the TDS rate, so one effective-dated revision is a
-- complete record of what a period was calculated under - rate, TDS, basis
-- and day-count inclusivity together. No new settings table: this is the
-- table the Interest module already versions via effective_from/effective_to.
--
-- ledger_entries gains a snapshot of the basis each posted Journal row was
-- accrued under, mirroring the rate_percent snapshot already there. Existing
-- rows keep NULL, which reads back as the ledger's historical default
-- (ACTUAL_365, exclusive day count) - so no already-posted amount changes.

ALTER TABLE "interest_configs" ADD COLUMN "tds_rate_percent" numeric(5, 2) DEFAULT '10' NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "interest_basis" "interest_basis";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "include_opening_closing_days" boolean;