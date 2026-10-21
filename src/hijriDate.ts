export const STATISTICS_TIME_ZONE = "Asia/Riyadh";
const CALENDAR = "ar-SA-u-ca-islamic-umalqura";

const parts = (date: Date) => new Intl.DateTimeFormat(CALENDAR, { timeZone: STATISTICS_TIME_ZONE,
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
  return new Intl.DateTimeFormat(CALENDAR, { timeZone: STATISTICS_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(date);
};

export const formatHijriMonth = (date: Date): string =>
  new Intl.DateTimeFormat(CALENDAR, { timeZone: STATISTICS_TIME_ZONE, month: "long", year: "numeric" }).format(date);

export const isSameHijriMonth = (a: Date, b: Date): boolean => hijriMonthKey(a) === hijriMonthKey(b);

/** حدود الشهر الهجري الحالي للحسابات التي تحتاج مدى زمنيًا. */
export function currentHijriMonthBounds(now = new Date()): { start: Date; end: Date } {
  const key=hijriMonthKey(now);
  let first=dateFromLocalKey(localDateKey(now))!,last=first;
  while(hijriMonthKey(addCalendarDays(first,-1))===key)first=addCalendarDays(first,-1);
  while(hijriMonthKey(addCalendarDays(last,1))===key)last=addCalendarDays(last,1);
  return {start:new Date(localDateKey(first)+'T00:00:00+03:00'),end:new Date(new Date(localDateKey(addCalendarDays(last,1))+'T00:00:00+03:00').getTime()-1)};
}
export function dateForCurrentWeekDay(dayIndex: number, now = new Date()): Date {
  return addCalendarDays(teachingWeekStart(now),dayIndex);
}

const latinParts = (date: Date) => new Intl.DateTimeFormat("en-SA-u-ca-islamic-umalqura", {
  day: "numeric", month: "numeric", year: "numeric", timeZone: STATISTICS_TIME_ZONE,
}).formatToParts(date);

const latinPart = (date: Date, type: Intl.DateTimeFormatPartTypes): number =>
  Number(latinParts(date).find((item) => item.type === type)?.value ?? 0);

/** مفتاح تاريخ محلي آمن؛ يبقى التخزين تقنيًا بينما يكون العرض هجريًا. */
export function localDateKey(date: Date): string {
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:STATISTICS_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(k=>p.find(v=>v.type===k)?.value).join('-');
}
export function dateFromLocalKey(value: string): Date | null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(value+'T12:00:00+03:00');
  return Number.isNaN(date.getTime())||localDateKey(date)!==value?null:date;
}
export function isTeachingWeekStart(value: string): boolean {
  const date = dateFromLocalKey(value);
  return !!date && date.getUTCDay() === 0;
}

/** الأحد الذي يبدأ أسبوع الكشف الحالي. */
export function teachingWeekStart(now = new Date()): Date {
  const date=dateFromLocalKey(localDateKey(now))!;
  return addCalendarDays(date,-date.getUTCDay());
}
export function addCalendarDays(value: Date | string, amount: number): Date {
  const original=value instanceof Date?value:(dateFromLocalKey(value)??new Date(value));
  const date=dateFromLocalKey(localDateKey(original));
  if(!date)return new Date(NaN);
  date.setUTCDate(date.getUTCDate()+amount);
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

/** تحويل الأرقام إلى عربية للتنسيق المتناسق. */
const toArDigits = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

/** تنسيق نطاق الأسبوع التعليمي الفعلي (الأحد إلى الأربعاء). */
export function formatTeachingWeekRange(value: Date | string, useArabicNumerals = true): string {
  const start = value instanceof Date ? value : (dateFromLocalKey(value) ?? new Date(value));
  if (Number.isNaN(start.getTime())) return "تاريخ الأسبوع غير محدد";
  const end = addCalendarDays(start, 3);
  const fmtDay = (date: Date) => {
    const weekday = new Intl.DateTimeFormat("ar", { weekday: "long" }).format(date);
    const day = useArabicNumerals ? toArDigits(date.getDate()) : String(date.getDate());
    const month = new Intl.DateTimeFormat("ar", { month: "long" }).format(date);
    return `${weekday} ${day} ${month}`;
  };
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

/** تواريخ أيام الأسبوع التعليمي الأربعة. */
export function getTeachingWeekDays(startDateIso: string): { key: string; label: string; date: Date; dateIso: string; formatted: string }[] {
  const start = dateFromLocalKey(startDateIso) ?? teachingWeekStart();
  const daysNames = [
    { key: "sun", label: "الأحد" },
    { key: "mon", label: "الاثنين" },
    { key: "tue", label: "الثلاثاء" },
    { key: "wed", label: "الأربعاء" },
  ];
  return daysNames.map((day, index) => {
    const date = addCalendarDays(start, index);
    const month = new Intl.DateTimeFormat("ar", { month: "long" }).format(date);
    return {
      key: day.key,
      label: day.label,
      date,
      dateIso: localDateKey(date),
      formatted: `${day.label} ${toArDigits(date.getDate())} ${month}`,
    };
  });
}
