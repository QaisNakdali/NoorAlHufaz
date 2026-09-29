export type CartLine = { itemId: string; qty: number };

/** يحذف المنتج المحدد فقط ويترك بقية السلة كما هي. */
export const removeCartLine = (cart: CartLine[], itemId: string): CartLine[] =>
  cart.filter((line) => line.itemId !== itemId);

export function parseStoredCart(value: string | null): CartLine[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine => {
      if (!line || typeof line !== "object") return false;
      const item = line as Partial<CartLine>;
      return typeof item.itemId === "string" && Number.isInteger(item.qty) && (item.qty ?? 0) > 0;
    });
  } catch {
    return [];
  }
}
