import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { MoneyStrip } from "../../../components/ui/MoneyStrip";
import { ErrorState, LoadingState, SuccessState } from "../../../components/ui/States";
import { ApiError } from "../../../lib/api";
import { formatAccrualMonth, formatCurrency, formatDate } from "../../../lib/format";
import { FIGURE } from "../../../lib/glossary";
import { listImports, postImport, previewImport, removeImport } from "../../get-kpi/api";
import { ImportPanel } from "../../get-kpi/components/ImportPanel";
import { KpiLedgerSection } from "../../get-kpi/components/KpiLedgerSection";
import { parseLedgerWorkbook, type ParsedSheet } from "../../get-kpi/xlsxParser";
import type { AnalyzedRow, ImportPreview, ImportSheetPayload } from "../../get-kpi/types";
import type { Loan } from "../types";

const KIND_LABEL: Record<NonNullable<AnalyzedRow["kind"]>, string> = {
  PAYMENT: "Disbursement",
  RECEIPT: "Receipt",
  JOURNAL_INTEREST: "Interest",
  JOURNAL_TDS: "TDS",
};

const KIND_CLASS: Record<NonNullable<AnalyzedRow["kind"]>, string> = {
  PAYMENT: "text-dr",
  RECEIPT: "text-cr",
  JOURNAL_INTEREST: "text-slate-700",
  JOURNAL_TDS: "text-slate-700",
};

/** Lower-case words of a name, without company suffixes, for matching a sheet heading to a borrower. */
function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["pvt", "private", "ltd", "limited", "llp", "the", "and", "p"].includes(w));
}

/** How well a sheet's heading names this loan: 2 = borrower name, 1 = only the loan number, 0 = neither. */
function matchScore(sheet: ParsedSheet, loan: Loan): number {
  const meta = (sheet.meta ?? "").toLowerCase();
  const words = nameWords(loan.borrowerName ?? "");
  const metaWords = new Set(nameWords(meta));
  if (words.length > 0 && words.every((w) => metaWords.has(w))) return 2;
  if (loan.loanAccountNumber && meta.includes(loan.loanAccountNumber.toLowerCase())) return 1;
  return 0;
}

function toPayload(fileName: string, sheet: ParsedSheet): ImportSheetPayload {
  return {
    fileName,
    sheetName: sheet.name,
    meta: sheet.meta,
    rows: sheet.rows.map(({ id: _id, ...row }) => row),
  };
}

/**
 * The loan's history from before it was kept here. Upload the client's
 * ledger workbook, pick the sheet for this loan, check every row against the
 * sheet's own balances, and post it into the ledger. Posted history becomes
 * this loan's ledger entries — the figures on every screen include it — and
 * month-end interest carries on automatically from the month after it.
 */
export function LoanHistoryTab({ loan }: { loan: Loan }) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);

  const imports = useQuery({ queryKey: ["ledger-imports", loan.id], queryFn: () => listImports(loan.id) });

  const sheet = sheets.find((s) => s.name === chosen) ?? null;

  const preview = useQuery({
    queryKey: ["ledger-import-preview", loan.id, fileName, chosen],
    queryFn: () => previewImport(loan.id, toPayload(fileName, sheet!)),
    enabled: !!sheet,
    staleTime: Infinity,
  });

  /** Everything posting or removing history changes: the ledger, the loan's figures, every list. */
  function refreshAll() {
    for (const queryKey of [
      ["ledger-imports", loan.id],
      ["kpi-ledger", loan.id],
      ["ledger", loan.id],
      ["ledger-dpd", loan.id],
      ["loan", loan.id],
      ["loans"],
      ["lookup"],
      ["dashboard-summary"],
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }

  const post = useMutation({
    mutationFn: () => postImport(loan.id, toPayload(fileName, sheet!)),
    onSuccess: (result) => {
      setPosted(
        `Posted ${sheet!.name} into the ledger.` + (result.loanStatus === "CLOSED" ? " The history pays the loan off, so it is now closed." : ""),
      );
      setSheets([]);
      setChosen(null);
      refreshAll();
    },
  });

  const remove = useMutation({
    mutationFn: (importId: string) => removeImport(loan.id, importId),
    onSuccess: refreshAll,
  });

  async function handleFile(file: File) {
    setPosted(null);
    post.reset();
    const parsed = await parseLedgerWorkbook(file);
    setFileName(file.name);
    setSheets(parsed);
    // Pre-pick the sheet whose heading names this loan's borrower (or, failing that, its loan number).
    const best = [...parsed].sort((a, b) => matchScore(b, loan) - matchScore(a, loan))[0]!;
    setChosen(matchScore(best, loan) > 0 || parsed.length === 1 ? best.name : null);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Import history</h2>
          <p className="text-sm text-slate-500">
            Upload the client&apos;s ledger workbook. Every sheet is read; pick the one for {loan.borrowerName}, check it, and post it.
          </p>
        </div>

        <ImportPanel onImport={handleFile} isImporting={false} />
        {posted && <SuccessState message={posted} />}

        {sheets.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              {sheets.length === 1 ? "Sheet in the file" : `${sheets.length} sheets in the file — which is this loan's?`}
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sheets.map((s) => {
                const isChosen = s.name === chosen;
                const score = matchScore(s, loan);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setChosen(s.name)}
                    className={`rounded-lg border bg-white p-4 text-left transition-colors ${
                      isChosen ? "border-accent ring-2 ring-accent/30" : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-slate-900">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.rows.length} rows</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">{s.meta ?? "No heading above the columns."}</p>
                    {score === 2 && <p className="mt-2 text-xs font-medium text-cr">Names {loan.borrowerName}</p>}
                    {score === 1 && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Mentions {loan.loanAccountNumber}, but not this borrower by name — check before posting
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sheet && preview.isLoading && <LoadingState label="Checking every row against the sheet..." />}
        {sheet && preview.isError && (
          <ErrorState message={preview.error instanceof ApiError ? preview.error.message : "Could not check the sheet."} />
        )}
        {sheet && preview.data && (
          <PreviewPanel
            preview={preview.data}
            sheetName={sheet.name}
            loanNumber={loan.loanAccountNumber}
            isPosting={post.isPending}
            onPost={() => post.mutate()}
            onDiscard={() => {
              setSheets([]);
              setChosen(null);
            }}
            postError={post.isError ? (post.error instanceof Error ? post.error.message : "Could not post the sheet.") : null}
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Posted history</h2>
        {imports.isLoading && <LoadingState label="Loading..." />}
        {imports.data && imports.data.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            No history has been posted to this loan yet.
          </p>
        )}
        {remove.isError && (
          <div className="mb-3">
            <ErrorState message={remove.error instanceof Error ? remove.error.message : "Could not remove the import."} />
          </div>
        )}
        <div className="flex flex-col gap-3">
          {imports.data?.map((imp) => (
            <div key={imp.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {formatDate(imp.firstEntryDate)} to {formatDate(imp.lastEntryDate)}
                </div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {imp.sheetName} in {imp.fileName}, {imp.rowCount} rows, closing balance {formatCurrency(Math.abs(Number(imp.closingBalance)), 2)}{" "}
                  {Number(imp.closingBalance) < 0 ? "Cr" : "Dr"}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {imp.lastInterestMonth
                    ? `Month-end interest is the ledger's own from ${formatAccrualMonth(nextMonth(imp.lastInterestMonth))}.`
                    : "The sheet has no interest entries."}{" "}
                  Posted {formatDate(imp.importedAt)}
                  {imp.importedByName ? ` by ${imp.importedByName}` : ""}.
                </div>
              </div>
              <Button
                variant="ghost"
                className="text-dr"
                disabled={remove.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove this history (${imp.rowCount} rows)? Every ledger entry it posted is taken out, and the loan's figures are recalculated.`,
                    )
                  ) {
                    remove.mutate(imp.id);
                  }
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </section>

      <KpiLedgerSection loanId={loan.id} />
    </div>
  );
}

/** First of the month after a YYYY-MM-01 date. */
function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, "0")}-01`;
}

function PreviewPanel({
  preview,
  sheetName,
  loanNumber,
  isPosting,
  onPost,
  onDiscard,
  postError,
}: {
  preview: ImportPreview;
  sheetName: string;
  loanNumber: string;
  isPosting: boolean;
  onPost: () => void;
  onDiscard: () => void;
  postError: string | null;
}) {
  const closing = preview.closingBalance;
  const blocked = preview.problems.length + preview.conflicts.length;

  return (
    <div className="flex flex-col gap-4">
      <MoneyStrip
        figures={[
          {
            label: "Period",
            value: <span className="text-lg">{preview.firstEntryDate ? `${formatDate(preview.firstEntryDate)} to ${formatDate(preview.lastEntryDate)}` : "—"}</span>,
          },
          { label: FIGURE.disbursed, value: formatCurrency(preview.totals.disbursed) },
          { label: FIGURE.received, value: formatCurrency(preview.totals.received) },
          { label: "Interest charged", value: formatCurrency(preview.totals.interest), note: `TDS ${formatCurrency(preview.totals.tds)}` },
          {
            label: "Closing balance",
            value: `${formatCurrency(Math.abs(closing))} ${closing < 0 ? "Cr" : "Dr"}`,
            note: closing === 0 ? "Paid off within the history" : undefined,
          },
        ]}
      />

      {blocked === 0 ? (
        <SuccessState message={`Every row reads, and every balance matches the sheet. ${sheetName} can be posted to ${loanNumber}.`} />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          <p className="font-semibold">This sheet cannot be posted yet.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {preview.problems.map((p) => (
              <li key={`p${p.index}`}>{p.index >= 0 ? `Row ${p.index + 1}: ${p.message}` : p.message}</li>
            ))}
            {preview.conflicts.map((c) => (
              <li key={c}>The ledger already has {c.charAt(0).toLowerCase() + c.slice(1)} Remove it, or import a sheet that starts after it.</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onPost} disabled={blocked > 0 || isPosting}>
          {isPosting ? "Posting…" : `Post to ${loanNumber}'s ledger`}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={isPosting}>
          Discard
        </Button>
      </div>
      {postError && <ErrorState message={postError} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-xs font-semibold text-slate-600">
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5 text-left">Particulars</th>
              <th className="px-4 py-2.5 text-left">In the sheet</th>
              <th className="px-4 py-2.5 text-left">Becomes</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
              <th className="px-4 py-2.5 text-right">Sheet balance</th>
              <th className="px-4 py-2.5 text-right">Ledger balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((r) => (
              <tr key={r.index} className={r.problem ? "bg-red-50" : undefined}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.entryDate ? formatDate(r.entryDate) : "—"}</td>
                <td className="max-w-sm px-4 py-2 text-slate-700">
                  {r.narration}
                  {r.problem && <div className="mt-0.5 text-xs font-medium text-red-700">{r.problem}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                  {r.sourceVchType} {r.sourceVchNo}
                </td>
                <td className={`whitespace-nowrap px-4 py-2 font-medium ${r.kind ? KIND_CLASS[r.kind] : "text-red-700"}`}>
                  {r.kind ? KIND_LABEL[r.kind] : "Cannot post"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-900">{r.amount !== null ? formatCurrency(r.amount, 2) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">
                  {r.sheetBalance !== null ? formatCurrency(r.sheetBalance, 2) : "—"}
                </td>
                <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${r.ties ? "text-slate-900" : "text-red-700"}`}>
                  {formatCurrency(r.computedBalance, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
