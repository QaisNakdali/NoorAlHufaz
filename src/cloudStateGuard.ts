/**
 * كل نسخة سحابية صحيحة في النظام تحتوي مصفوفة students (وقد تكون فارغة).
 * رفض الكائنات الجزئية أو التالفة يمنع تطبيعها إلى بيانات افتراضية ثم رفعها
 * فوق بيانات حقيقية. هذا الحارس لا يعدّل أي سجل.
 */
export function hasCloudStudentCollection(value: unknown): value is { students: unknown[] } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { students?: unknown }).students));
}
