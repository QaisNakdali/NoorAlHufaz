import type { DailyWard } from "./core.ts";

const DECIMAL_SCALE = 10_000;

/** يحفظ الكسور المدخلة دون ضجيج floating point، ويرفض السالب/NaN/Infinity. */
export function safeNonNegativeDecimal(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  return Math.round(number * DECIMAL_SCALE) / DECIMAL_SCALE;
}

/** مصدر الحقيقة الجديد للمراجعة: الصفحات، و15 سطرًا لكل صفحة. */
export function reviewLinesFromPages(value: unknown): number {
  const pages = safeNonNegativeDecimal(value) ?? 0;
  return Math.round(pages * 15 * DECIMAL_SCALE) / DECIMAL_SCALE;
}

/** يحافظ على الأسطر القديمة، ويشتق الأسطر فقط عندما توجد صفحات جديدة صريحة. */
export function reviewLinesForWard(ward: Partial<DailyWard> | null | undefined): number {
  if (!ward) return 0;
  if (safeNonNegativeDecimal(ward.reviewPages) !== undefined) return reviewLinesFromPages(ward.reviewPages);
  return safeNonNegativeDecimal(ward.reviewLines) ?? 0;
}
