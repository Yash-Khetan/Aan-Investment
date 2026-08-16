/**
 * Days between two dates. By default exclusive of one endpoint (the
 * standard convention already used everywhere in this codebase). Pass
 * `inclusive: true` to count both periodStart and periodEnd (+1 day) —
 * the "Include Opening & Closing Days" interest config setting.
 */
export function diffInDays(start: Date, end: Date, inclusive = false): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const days = Math.round((endUTC - startUTC) / MS_PER_DAY);
  return inclusive ? days + 1 : days;
}

export function diffInMonths(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export function daysInMonth30360(_date: Date): number {
  // 30/360 convention: every month treated as 30 days
  return 30;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}


export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}