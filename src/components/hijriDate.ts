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

const latinParts = (date: Date) => new Intl.DateTimeFormat("en-SA-u-ca-islamic-umalqura", {
  day: "numeric", month: "numeric", year: "numeric",
}).formatToParts(date);

const latinPart = (date: Date, type: Intl.DateTimeFormatPartTypes): number =>
  Number(latinParts(date).find((item) => item.type === type)?.value ?? 0);

/** مفتاح تاريخ محلي آمن؛ يبقى التخزين تقنيًا بينما يكون العرض هجريًا. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromLocalKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) || localDateKey(date) !== value ? null : date;
}

/** الأحد الذي يبدأ أسبوع الكشف الحالي. */
export function teachingWeekStart(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function addCalendarDays(value: Date | string, amount: number): Date {
  const date = value instanceof Date ? new Date(value) : (dateFromLocalKey(value) ?? new Date(value));
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + amount);
  return date;
}

export function formatHijriDay(value: Date | string): string {
  const date = value instanceof Date ? value : (dateFromLocalKey(value) ?? new Date(value));
  return formatHijriDate(date, { weekday: "long", day: "numeric", month: "long" });
}

export function formatTeachingWeek(value: string): string {
  const start = dateFromLocalKey(value);
  if (!start) return "تاريخ الأسبوع غير محدد";
  return `${formatHijriDay(start)} — ${formatHijriDay(addCalendarDays(start, 3))}`;
}

/** صيغة قابلة للتحرير يدويًا: سنة-شهر-يوم هجري. */
export function hijriInputValue(value: string): string {
  const date = dateFromLocalKey(value);
  if (!date) return "";
  return `${latinPart(date, "year")}-${String(latinPart(date, "month")).padStart(2, "0")}-${String(latinPart(date, "day")).padStart(2, "0")}`;
}

const normalizeDigits = (value: string): string => value
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

/** يحول إدخالًا هجريًا إلى مفتاح ميلادي داخلي بدون تغيير أي سجل قديم. */
export function parseHijriInput(value: string, around = new Date()): string | null {
  const match = /^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})$/.exec(normalizeDigits(value.trim()));
  if (!match) return null;
  const target = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(around);
  probe.setHours(12, 0, 0, 0);
  probe.setDate(probe.getDate() - 800);
  for (let index = 0; index <= 1600; index += 1) {
    if (latinPart(probe, "year") === target[0] && latinPart(probe, "month") === target[1] && latinPart(probe, "day") === target[2]) return localDateKey(probe);
    probe.setDate(probe.getDate() + 1);
  }
  return null;
}
