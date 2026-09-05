/** A coded dropdown value paired with the label the module saved it under. */
interface CodedOption {
  value: string;
  label: string;
}

/** Show a coded value's own wording, falling back to the raw code. */
export function labelOf(options: CodedOption[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}
