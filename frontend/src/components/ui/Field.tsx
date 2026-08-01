import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { InfoTooltip } from "./Tooltip";

function Label({ children, required, tooltip }: PropsWithChildren<{ required?: boolean; tooltip?: string }>) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-600">
      {children}
      {required && <span className="text-red-500"> *</span>}
      {tooltip && <InfoTooltip text={tooltip} />}
    </label>
  );
}

const inputClasses =
  "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

export function TextField({
  label,
  required,
  tooltip,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean; tooltip?: string }) {
  return (
    <div>
      <Label required={required} tooltip={tooltip}>
        {label}
      </Label>
      <input className={inputClasses} required={required} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  required,
  children,
  ...props
}: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean }>) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <select className={inputClasses} required={required} {...props}>
        {children}
      </select>
    </div>
  );
}

export function TextAreaField({
  label,
  required,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; required?: boolean }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <textarea className={inputClasses} rows={2} required={required} {...props} />
    </div>
  );
}
