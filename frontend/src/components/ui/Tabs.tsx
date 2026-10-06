import { useSearchParams } from "react-router-dom";

export interface TabDef<K extends string> {
  key: K;
  label: string;
}

/**
 * The active tab of a page, kept in the URL (?tab=ledger) so a tab can be
 * linked to, bookmarked and returned to with the back button.
 */
export function useTab<K extends string>(tabs: TabDef<K>[]): [K, (key: K) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const active = (tabs.find((t) => t.key === requested)?.key ?? tabs[0]!.key) as K;
  const setActive = (key: K) => {
    const next = new URLSearchParams(params);
    if (key === tabs[0]!.key) next.delete("tab");
    else next.set("tab", key);
    setParams(next, { replace: true });
  };
  return [active, setActive];
}

export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="-mx-1 mb-6 overflow-x-auto border-b border-slate-300" role="tablist">
      <div className="flex gap-1 px-1">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
