import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import type { LedgerRow, RowParameter } from "../types";
import { buildRowScope, evaluateFormula } from "../formulaEngine";

let nextParamId = 1;

export function RowFormulaEditor({
  row,
  onSaveParameters,
  onSaveOutput,
}: {
  row: LedgerRow;
  onSaveParameters: (parameters: RowParameter[]) => void;
  onSaveOutput: (output: LedgerRow["output"]) => void;
}) {
  const [parameters, setParameters] = useState<RowParameter[]>(row.parameters);
  const [outputName, setOutputName] = useState(row.output?.name ?? "result");
  const [formula, setFormula] = useState(row.output?.formula ?? "");

  const rowFields = ["debit", "credit", "balance", "principal"];
  const availableNames = [...rowFields, ...parameters.filter((p) => p.name.trim() !== "").map((p) => p.name)];

  function addParameter() {
    setParameters((prev) => [...prev, { id: `param-${nextParamId++}`, name: "", value: 0, isPercent: false }]);
  }

  function updateParameter(id: string, patch: Partial<RowParameter>) {
    setParameters((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removeParameter(id: string) {
    setParameters((prev) => prev.filter((p) => p.id !== id));
  }

  function handleSaveParameters() {
    onSaveParameters(parameters.filter((p) => p.name.trim() !== ""));
  }

  function handleCalculate() {
    const scope = {
      ...buildRowScope(row),
      ...Object.fromEntries(parameters.filter((p) => p.name.trim() !== "").map((p) => [p.name, p.value])),
    };
    const result = evaluateFormula(formula, scope);
    if ("error" in result) {
      onSaveOutput({ name: outputName || "result", formula, result: null, error: result.error });
    } else {
      onSaveOutput({ name: outputName || "result", formula, result: result.value });
    }
  }

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parameters</h3>
          <Button type="button" variant="secondary" onClick={addParameter}>
            + Add Parameter
          </Button>
        </div>

        {parameters.length === 0 ? (
          <p className="text-xs text-slate-400">No parameters yet — add one, e.g. name "interest", value 21%.</p>
        ) : (
          <div className="space-y-2">
            {parameters.map((param) => (
              <div key={param.id} className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <TextField
                    label="Name"
                    value={param.name}
                    onChange={(e) => updateParameter(param.id, { name: e.target.value })}
                    placeholder="interest"
                  />
                </div>
                <div className="w-32">
                  <TextField
                    label={param.isPercent ? "Value (%)" : "Value"}
                    type="number"
                    step="0.0001"
                    value={param.isPercent ? param.value * 100 : param.value}
                    onChange={(e) => {
                      const raw = Number.parseFloat(e.target.value) || 0;
                      updateParameter(param.id, { value: param.isPercent ? raw / 100 : raw });
                    }}
                  />
                </div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={param.isPercent}
                    onChange={(e) => {
                      const isPercent = e.target.checked;
                      updateParameter(param.id, { isPercent });
                    }}
                  />
                  is %
                </label>
                <Button type="button" variant="ghost" onClick={() => removeParameter(param.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={handleSaveParameters}>
            Save Parameters
          </Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Custom Formula</h3>
        <p className="mb-2 text-xs text-slate-400">
          Available names: <span className="font-mono text-slate-600">{availableNames.join(", ") || "—"}</span>
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <TextField label="Output Name" value={outputName} onChange={(e) => setOutputName(e.target.value)} />
          </div>
          <div className="min-w-64 flex-1">
            <TextField
              label="Formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="debit * interest"
            />
          </div>
          <Button type="button" onClick={handleCalculate}>
            Calculate
          </Button>
        </div>

        {row.output && (
          <div className="mt-3 text-sm">
            {row.output.error ? (
              <span className="text-red-600">Error: {row.output.error}</span>
            ) : (
              <span className="text-slate-700">
                <span className="font-medium">{row.output.name}</span> ={" "}
                <span className="font-semibold text-slate-900">
                  {row.output.result?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
