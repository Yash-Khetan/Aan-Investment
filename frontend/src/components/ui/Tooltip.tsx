import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The same "(i)" icon, revealing richer `children` on hover, focus or click
 * (click for touch screens). The panel is fixed-positioned against the icon,
 * so a scrolling table's `overflow` can't clip it the way it would clip
 * InfoTooltip's absolutely-positioned one.
 */
export function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const iconRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [pinned, setPinned] = useState(false);

  // Fixed against where the icon was, so any scroll would leave it behind.
  useEffect(() => {
    if (!position) return;
    const close = () => {
      setPinned(false);
      setPosition(null);
    };
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [position]);

  function show() {
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  }

  function hide() {
    if (!pinned) setPosition(null);
  }

  return (
    <span className="ml-1.5 inline-flex items-center align-middle">
      <button
        ref={iconRef}
        type="button"
        aria-label={label}
        aria-expanded={!!position}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-400 text-[10px] font-bold leading-none text-white outline-none hover:bg-slate-500 focus:ring-2 focus:ring-slate-400"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={() => {
          setPinned(false);
          setPosition(null);
        }}
        onClick={() => {
          setPinned((p) => !p);
          show();
        }}
      >
        i
      </button>
      {position && (
        <span
          role="tooltip"
          style={{ top: position.top, left: position.left }}
          className="fixed z-50 w-64 -translate-x-1/2 rounded-md bg-slate-800 px-3 py-2 text-xs font-normal normal-case leading-snug text-white shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** Small "(i)" info icon that reveals a tooltip with `text` on hover/focus. */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex items-center align-middle">
      <span
        tabIndex={0}
        className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold leading-none text-white outline-none focus:ring-2 focus:ring-slate-400"
        aria-label={text}
      >
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}
