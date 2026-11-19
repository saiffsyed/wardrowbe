// Dates arrive as "YYYY-MM-DD" in the person's own time zone. Reading them at noon keeps the
// weekday right in every time zone the browser might be in.
export function dayDate(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

export function weekdayShort(day: string, locale: string): string {
  return dayDate(day).toLocaleDateString(locale, { weekday: 'short' });
}

export function dayAndMonth(day: string, locale: string): string {
  return dayDate(day).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function addDays(day: string, count: number): string {
  const date = dayDate(day);
  date.setDate(date.getDate() + count);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
