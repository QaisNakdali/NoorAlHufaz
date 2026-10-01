/** يبقي الفراغ مسموحًا أثناء التحرير ويحذف الأصفار البادئة غير الضرورية. */
export function normalizeNumericDraft(raw: string): string {
  const latin = raw
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٫,]/g, ".")
    .replace(/[^\d.]/g, "");
  const [whole = "", ...fractions] = latin.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  return fractions.length ? `${normalizedWhole || "0"}.${fractions.join("")}` : normalizedWhole;
}
