/**
 * يستبدل صور data URL بمراجع سحابية مع رفع كل صورة فريدة مرة واحدة فقط.
 * الدالة لا تحذف حقلاً أو سجلًا؛ تتغير قيمة الصورة فقط من البايتات المضمّنة
 * إلى رابط يعرض البايتات نفسها من التخزين السحابي.
 */
export async function externalizeDataImages(
  value: unknown,
  upload: (dataUrl: string) => Promise<string>,
): Promise<unknown> {
  const containsDataImage = (root: unknown): boolean => {
    const pending: unknown[] = [root];
    while (pending.length) {
      const current = pending.pop();
      if (typeof current === "string" && current.startsWith("data:image/")) return true;
      if (Array.isArray(current)) pending.push(...current);
      else if (current && typeof current === "object") pending.push(...Object.values(current as Record<string, unknown>));
    }
    return false;
  };

  // المسار المعتاد بعد الترقية: لا توجد صور مضمّنة، فنعيد نفس المرجع دون
  // نسخ الحالة كاملة في الذاكرة عند كل حفظ.
  if (!containsDataImage(value)) return value;

  const uploads = new Map<string, Promise<string>>();

  const visit = async (current: unknown): Promise<unknown> => {
    if (typeof current === "string" && current.startsWith("data:image/")) {
      let pending = uploads.get(current);
      if (!pending) {
        pending = upload(current).catch(() => current);
        uploads.set(current, pending);
      }
      return pending;
    }
    if (Array.isArray(current)) return Promise.all(current.map(visit));
    if (!current || typeof current !== "object") return current;

    const entries = await Promise.all(
      Object.entries(current as Record<string, unknown>)
        .map(async ([key, child]) => [key, await visit(child)] as const),
    );
    return Object.fromEntries(entries);
  };

  return visit(value);
}
