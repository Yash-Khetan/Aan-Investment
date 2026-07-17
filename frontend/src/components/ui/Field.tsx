import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function Label({ children, required }: PropsWithChildren<{ required?: boolean }>) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-600">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

const inputClasses =
  "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

export function TextField({
  label,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
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
