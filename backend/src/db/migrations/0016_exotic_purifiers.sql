-- Renames the gender enum value TRANSGENDER -> OTHERS.
--
-- Hand-written in place of the generated migration, which dropped and recreated
-- the type: that casts both borrowers.gender and promoters.gender to text, drops
-- the enum, then casts back — and any row still holding 'TRANSGENDER' would fail
-- the final cast. RENAME VALUE is atomic, touches no table, and carries existing
-- rows across automatically because the label itself is what changes.
ALTER TYPE "public"."gender" RENAME VALUE 'TRANSGENDER' TO 'OTHERS';
