import { useEffect, useRef } from "react";

const DRAFT_PREFIX = "draft:";
const AUTOSAVE_INTERVAL_MS = 30_000;

function draftKey(key: string): string {
  return `${DRAFT_PREFIX}${key}`;
}

/**
 * Periodically persists `value` to localStorage under a namespaced key, so an
 * in-progress form survives an accidental refresh/navigation within the same
 * login session. Drafts are best-effort (never block the UI on a write
 * failure) and are scoped to the session: call `clearAllDrafts()` on logout
 * to discard everything, since a draft has no meaning once the session that
 * produced it is gone.
 */
export function useAutosaveDraft<T>(key: string, value: T, enabled: boolean): void {
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      try {
        localStorage.setItem(draftKey(key), JSON.stringify(valueRef.current));
      } catch {
        // Storage full/unavailable — autosave is best-effort, ignore.
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [key, enabled]);
}

/** Reads a previously autosaved draft, if any. Returns null when absent, unparsable, or storage is unavailable. */
export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Discards one draft — call this once its data has been successfully saved to the server. */
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(draftKey(key));
  } catch {
    // ignore
  }
}

/** Discards every autosaved draft. Call on logout — drafts don't outlive the session that created them. */
export function clearAllDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
