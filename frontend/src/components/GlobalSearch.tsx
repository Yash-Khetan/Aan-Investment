import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBorrowerLookup, useLoanLookup } from "../features/lookup/hooks";

interface Result {
  key: string;
  to: string;
  primary: string;
  secondary: string;
  kind: "Loan" | "Borrower";
}

const MAX_RESULTS = 8;

/**
 * Type a loan number or a borrower's name (or code) and jump straight to it.
 * Matches against the lookup lists every page already caches, so it answers
 * instantly. Arrow keys move through the results; Enter opens one.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const loans = useLoanLookup();
  const borrowers = useBorrowerLookup();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const loanHits: Result[] = (loans.data ?? [])
      .filter((l) => l.loanAccountNumber.toLowerCase().includes(q) || l.customerName.toLowerCase().includes(q))
      .map((l) => ({
        key: `loan-${l.id}`,
        to: `/loans/${l.id}`,
        primary: l.loanAccountNumber,
        secondary: l.customerName,
        kind: "Loan",
      }));
    const borrowerHits: Result[] = (borrowers.data ?? [])
      .filter((b) => b.name.toLowerCase().includes(q) || b.borrowerCode.toLowerCase().includes(q))
      .map((b) => ({
        key: `borrower-${b.id}`,
        to: `/borrowers/${b.id}`,
        primary: b.name,
        secondary: b.borrowerCode,
        kind: "Borrower",
      }));
    return [...loanHits, ...borrowerHits].slice(0, MAX_RESULTS);
  }, [query, loans.data, borrowers.data]);

  function go(result: Result) {
    navigate(result.to);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      go(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showList = open && query.trim() !== "";

  return (
    <div className="relative w-full max-w-md">
      <label htmlFor="global-search" className="sr-only">
        Search loans and borrowers
      </label>
      <input
        id="global-search"
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder="Find a loan number or borrower"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:bg-white focus:outline-none"
      />
      {showList && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-lg">
          {results.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-500">No loan or borrower matches.</li>}
          {results.map((r, i) => (
            <li key={r.key}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                  i === highlight ? "bg-accent-soft" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{r.primary}</span>
                  <span className="block truncate text-xs text-slate-500">{r.secondary}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
