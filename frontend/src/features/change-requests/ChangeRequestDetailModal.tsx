import { Button } from "../../components/ui/Button";
import { ENTITY_TYPE_LABELS, type ChangeRequest } from "./types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** The union of field names present in either side of the before/after pair. */
function fieldNames(a: Record<string, unknown> | null, b: Record<string, unknown> | null): string[] {
  return Array.from(new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]));
}

export function ChangeRequestDetailModal({
  changeRequest,
  onClose,
}: {
  changeRequest: ChangeRequest;
  onClose: () => void;
}) {
  const fields = fieldNames(changeRequest.previousValues, changeRequest.payload);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            {changeRequest.action} · {ENTITY_TYPE_LABELS[changeRequest.entityType]}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto text-xs">
          {fields.length === 0 && <div className="text-slate-500">No field-level detail to show.</div>}
          {fields.map((field) => (
            <div key={field} className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-2">
              <div className="font-medium text-slate-600">{field}</div>
              <div className="text-slate-500 line-through">
                {formatValue(changeRequest.previousValues?.[field])}
              </div>
              <div className="font-medium text-slate-900">{formatValue(changeRequest.payload?.[field])}</div>
            </div>
          ))}
          {changeRequest.reviewNotes && (
            <div className="mt-3 rounded-md border border-slate-200 p-2">
              <div className="font-medium text-slate-600">Review notes</div>
              <div className="mt-1 text-slate-800">{changeRequest.reviewNotes}</div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
