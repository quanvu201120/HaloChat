type DateInput = string | Date | null | undefined;

function parseDate(date: DateInput): Date | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatDatePart(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTimePart(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateVN(date: DateInput): string {
  const parsed = parseDate(date);
  if (!parsed) return 'Chưa xác định';
  return `${formatTimePart(parsed)} ${formatDatePart(parsed)}`;
}

export function formatDateOnlyVN(date: DateInput): string {
  const parsed = parseDate(date);
  if (!parsed) return 'Chưa xác định';
  return formatDatePart(parsed);
}

export function formatTimeVN(date: DateInput): string {
  const parsed = parseDate(date);
  if (!parsed) return 'Chưa xác định';
  return formatTimePart(parsed);
}
