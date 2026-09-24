const CALENDAR = "ar-SA-u-ca-islamic-umalqura";

const parts = (date: Date) => new Intl.DateTimeFormat(CALENDAR, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
}).formatToParts(date);

const part = (date: Date, type: Intl.DateTimeFormatPartTypes): string =>
  parts(date).find((item) => item.type === type)?.value ?? "";

/** مفتاح داخلي للشهر الهجري مع إبقاء التواريخ المخزنة بصيغتها الآمنة الحالية. */
export const hijriMonthKey = (date: Date): string => `${part(date, "year")}-${part(date, "month").padStart(2, "0")}`;

export const formatHijriDate = (value: Date | string | number, options: Intl.DateTimeFormatOptions = {}): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "تاريخ غير متاح";
  return new Intl.DateTimeFormat(CALENDAR, {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(date);
};

export const formatHijriMonth = (date: Date): string =>
  new Intl.DateTimeFormat(CALENDAR, { month: "long", year: "numeric" }).format(date);

export const isSameHijriMonth = (a: Date, b: Date): boolean => hijriMonthKey(a) === hijriMonthKey(b);

/** حدود الشهر الهجري الحالي للحسابات التي تحتاج مدى زمنيًا. */
export function currentHijriMonthBounds(now = new Date()): { start: Date; end: Date } {
  const key = hijriMonthKey(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  while (hijriMonthKey(new Date(start.getTime() - 86_400_000)) === key) start.setDate(start.getDate() - 1);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  while (hijriMonthKey(new Date(end.getTime() + 1)) === key) end.setDate(end.getDate() + 1);
  return { start, end };
}

export function dateForCurrentWeekDay(dayIndex: number, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + dayIndex);
  return start;
}
