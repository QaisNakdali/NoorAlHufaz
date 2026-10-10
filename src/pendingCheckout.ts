import type { CheckoutLine } from "./checkoutTransaction.ts";
export type PendingCheckout = { requestId: string; purchasedAt: string; studentId: string; lines: CheckoutLine[]; allowClosedStore: boolean; submittedLocal?: unknown; acknowledged?: boolean };
export type CheckoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const signature = (lines: CheckoutLine[]): string => {
  const quantities = new Map<string, number>();
  for (const line of lines) quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.qty);
  return JSON.stringify([...quantities].sort(([a],[b])=>a.localeCompare(b)));
};
/** Persist BEFORE sending a write. An ambiguous retry uses the same operation ID. */
export function beginPendingCheckout(storage: CheckoutStorage, key: string, proposed: PendingCheckout): { operation: PendingCheckout; resumed: boolean } {
  const raw = storage.getItem(key);
  if (raw) {
    const prior = JSON.parse(raw) as PendingCheckout;
    if (!prior.requestId || !Number.isFinite(Date.parse(prior.purchasedAt)) || !Array.isArray(prior.lines)) throw new Error("تعذر قراءة العملية المعلقة؛ لا تبدأ شراءً جديدًا قبل التحقق من سجل المشتريات");
    if (prior.studentId !== proposed.studentId || prior.allowClosedStore !== proposed.allowClosedStore || signature(prior.lines) !== signature(proposed.lines)) {
      throw new Error("توجد عملية شراء غير مؤكدة لهذا الطالب؛ أعد محاولة المنتج نفسه أولًا للتحقق منها بأمان");
    }
    return { operation: prior, resumed: true };
  }
  storage.setItem(key, JSON.stringify(proposed));
  return { operation: proposed, resumed: false };
}
