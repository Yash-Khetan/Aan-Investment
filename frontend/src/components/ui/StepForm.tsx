import { useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export interface FormStep {
  key: string;
  title: string;
  /** One line under the step's heading saying what it collects. */
  description?: string;
  content: ReactNode;
}

/** The first control in `el` the browser considers invalid, if any. */
function firstInvalid(el: HTMLElement | null): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  if (!el) return null;
  const controls = el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
  for (const c of controls) if (!c.checkValidity()) return c;
  return null;
}

/**
 * A long form broken into steps, shown one at a time with the steps laid out
 * across the top. Every step stays mounted, so nothing typed is lost moving
 * between them.
 *
 * Next checks only the current step. Saving checks every step in order and,
 * if one is incomplete, opens it and points at the field. When `freeNavigation`
 * is on (editing an existing record) any step can be opened directly;
 * otherwise only steps already reached can.
 */
export function StepForm({
  steps,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  onCancel,
  freeNavigation = false,
  footer,
}: {
  steps: FormStep[];
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting?: boolean;
  onCancel?: () => void;
  freeNavigation?: boolean;
  /** Shown above the buttons — errors and notices from saving. */
  footer?: ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  const [reached, setReached] = useState(freeNavigation ? steps.length - 1 : 0);
  const panels = useRef<Array<HTMLDivElement | null>>([]);

  // Steps can come and go (a borrower type with no related persons), so keep
  // the index in range.
  const index = Math.min(current, steps.length - 1);
  const isLast = index === steps.length - 1;

  function open(i: number) {
    setCurrent(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Opens step `i` and has the browser explain what is wrong with `control`. */
  function point(i: number, control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    setCurrent(i);
    // Wait for the step to be shown before the browser can focus into it.
    requestAnimationFrame(() => control.reportValidity());
  }

  function next() {
    const invalid = firstInvalid(panels.current[index] ?? null);
    if (invalid) return point(index, invalid);
    open(index + 1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (let i = 0; i < steps.length; i++) {
      const invalid = firstInvalid(panels.current[i] ?? null);
      if (invalid) return point(i, invalid);
    }
    onSubmit();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <ol className="flex overflow-x-auto rounded-lg border border-slate-200 bg-white" aria-label="Form steps">
        {steps.map((step, i) => {
          const isCurrent = i === index;
          const isDone = i < index || (freeNavigation && i !== index);
          const canOpen = freeNavigation || i <= reached;
          return (
            <li key={step.key} className="min-w-0 flex-1 border-r border-slate-200 last:border-r-0">
              <button
                type="button"
                disabled={!canOpen}
                onClick={() => canOpen && setCurrent(i)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex w-full items-center gap-3 border-b-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${
                  isCurrent ? "border-accent bg-accent-soft" : "border-transparent hover:bg-slate-50 disabled:hover:bg-transparent"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    isCurrent
                      ? "bg-accent text-white"
                      : isDone && canOpen
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`truncate text-sm font-medium ${isCurrent ? "text-slate-900" : "text-slate-600"}`}>
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {steps.map((step, i) => (
        <div
          key={step.key}
          ref={(el) => {
            panels.current[i] = el;
          }}
          hidden={i !== index}
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
            {step.description && <p className="mt-0.5 text-sm text-slate-500">{step.description}</p>}
          </div>
          <div className="flex flex-col gap-6">{step.content}</div>
        </div>
      ))}

      {footer}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        {index > 0 && (
          <Button type="button" variant="secondary" onClick={() => setCurrent(index - 1)}>
            Back
          </Button>
        )}
        {!isLast && (
          <Button type="button" onClick={next}>
            Next: {steps[index + 1]!.title}
          </Button>
        )}
        {(isLast || freeNavigation) && (
          <Button type="submit" disabled={isSubmitting} variant={isLast ? "primary" : "secondary"}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        )}
        <span className="ml-auto text-sm text-slate-500">
          Step {index + 1} of {steps.length}
        </span>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
