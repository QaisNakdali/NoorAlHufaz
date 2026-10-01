/**
 * يبني نسخة التخزين المحلي دون مضاعفة الحالة كاملة في الوضع النظيف.
 * نحتاج لقطة الأساس فقط عندما توجد تغييرات محلية معلقة لعمل الدمج الثلاثي
 * بعد إعادة فتح الصفحة. حذفها من النسخة النظيفة لا يمس بيانات التطبيق.
 */
export function buildLocalSnapshot<T extends object>(
  data: T,
  rev: number,
  dirty: boolean,
  syncedBase: T | null,
): T & { __rev: number; __dirty: boolean; __base?: T } {
  return {
    ...data,
    __rev: rev,
    __dirty: dirty,
    ...(dirty && syncedBase ? { __base: syncedBase } : {}),
  };
}
