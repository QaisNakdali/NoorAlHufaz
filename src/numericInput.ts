/** يبقي الفراغ مسموحًا أثناء التحرير ويحذف الأصفار البادئة غير الضرورية. */
export function normalizeNumericDraft(raw: string): string {
  return raw === "" ? "" : raw.replace(/^0+(?=\d)/, "");
}
