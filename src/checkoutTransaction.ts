import { bagQty, equipOn, levelInfo, MAX_HEARTS, type PurchaseOrder, type ShopItem, type Student } from "./core.ts";

export const HEART_ITEM_ID = "__restore-heart__";

export type CheckoutLine = { itemId: string; qty: number };

export type CheckoutState = {
  parentStoreOpen: boolean;
  heartPrice: number;
  students: Student[];
  products: ShopItem[];
  orders: PurchaseOrder[];
};

export type CheckoutResult =
  | { success: true; state: CheckoutState; totalCost: number; orderIds: string[]; alreadyApplied: boolean }
  | { success: false; error: string };

/**
 * Pure checkout transaction. The caller must commit the returned state with a
 * compare-and-swap against the cloud revision so stock, coins and orders move
 * together or not at all.
 */
export function applyCheckoutTransaction(
  state: CheckoutState,
  studentId: string,
  lines: CheckoutLine[],
  requestId: string,
  purchasedAt: string,
  allowClosedStore = false,
): CheckoutResult {
  const existing = state.orders.filter((order) => order.requestId === requestId);
  if (existing.length > 0) {
    return {
      success: true,
      state,
      totalCost: existing.reduce((sum, order) => sum + order.price, 0),
      orderIds: existing.map((order) => order.id),
      alreadyApplied: true,
    };
  }

  if (!allowClosedStore && !state.parentStoreOpen) return { success: false, error: "المتجر مغلق حاليًا من قِبل إدارة الحلقة" };
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return { success: false, error: "لم يتم العثور على الطالب" };
  if (!Array.isArray(lines) || lines.length === 0) return { success: false, error: "لم يتم تحديد منتج للشراء" };

  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (!line || typeof line.itemId !== "string" || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) {
      return { success: false, error: "كمية الشراء غير صالحة" };
    }
    quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.qty);
  }

  const buyingHeart = quantities.has(HEART_ITEM_ID);
  if (buyingHeart && quantities.size !== 1) {
    return { success: false, error: "يجب شراء القلب في عملية مستقلة" };
  }
  if (buyingHeart) {
    const qty = quantities.get(HEART_ITEM_ID) ?? 0;
    if (qty !== 1) return { success: false, error: "يمكن استعادة قلب واحد في كل عملية" };
    if (student.hearts >= MAX_HEARTS) return { success: false, error: "قلوب الطالب مكتملة بالفعل" };
    const price = Math.max(0, Math.round(state.heartPrice));
    if (student.coins < price) return { success: false, error: `رصيد العملات غير كافٍ. المطلوب: ${price}، المتوفر: ${student.coins}` };
    const orderId = `${requestId}:heart`;
    const order: PurchaseOrder = {
      id: orderId,
      requestId,
      studentId: student.id,
      studentName: student.name,
      itemId: HEART_ITEM_ID,
      itemName: "استعادة قلب",
      itemKind: "heart",
      itemIcon: "heart",
      unitPrice: price,
      quantity: 1,
      price,
      purchasedAt,
      status: "delivered",
      deliveredAt: purchasedAt,
    };
    return {
      success: true,
      state: {
        ...state,
        students: state.students.map((current) => current.id === student.id ? {
          ...current,
          coins: current.coins - price,
          coinsSpent: (current.coinsSpent ?? 0) + price,
          hearts: Math.min(MAX_HEARTS, current.hearts + 1),
        } : current),
        orders: [order, ...state.orders],
      },
      totalCost: price,
      orderIds: [orderId],
      alreadyApplied: false,
    };
  }

  if (student.hearts <= 0) {
    return { success: false, error: "نفدت قلوب الطالب؛ يجب شراء قلب جديد أولًا" };
  }

  const level = levelInfo(student.xp).level;
  const resolved: Array<{ item: ShopItem; qty: number }> = [];
  let totalCost = 0;
  for (const [itemId, qty] of quantities) {
    const product = state.products.find((item) => item.id === itemId);
    if (!product) return { success: false, error: "أحد المنتجات لم يعد متوفرًا" };
    if (level < product.minLevel) return { success: false, error: `المنتج «${product.name}» يتطلب المستوى ${product.minLevel}` };
    if (typeof product.stock === "number" && product.stock < qty) {
      return { success: false, error: `عذرًا، الكمية المتوفرة من «${product.name}» لم تعد تكفي` };
    }
    const cosmetic = product.kind === "cosmetic";
    const ownedQty = cosmetic ? (student.inventory.includes(product.id) ? 1 : 0) : bagQty(student, product.id);
    if (cosmetic && ownedQty > 0) return { success: false, error: `الطالب يملك «${product.name}» بالفعل` };
    if (!cosmetic && !product.repeatable && ownedQty > 0) return { success: false, error: `تم شراء «${product.name}» مسبقًا` };
    totalCost += product.price * qty;
    resolved.push({ item: product, qty });
  }

  if (student.coins < totalCost) {
    return { success: false, error: `رصيد العملات غير كافٍ. المطلوب: ${totalCost}، المتوفر: ${student.coins}` };
  }

  const orderIds: string[] = [];
  const newOrders: PurchaseOrder[] = resolved.map(({ item, qty }, index) => {
    const id = `${requestId}:${index + 1}`;
    orderIds.push(id);
    return {
      id,
      requestId,
      studentId: student.id,
      studentName: student.name,
      itemId: item.id,
      itemName: item.name,
      itemKind: item.kind === "cosmetic" ? "cosmetic" : "physical",
      itemImage: item.image ?? null,
      itemIcon: item.icon,
      unitPrice: item.price,
      quantity: qty,
      price: item.price * qty,
      purchasedAt,
      status: "pending",
    };
  });

  const products = state.products.map((product) => {
    const line = resolved.find(({ item }) => item.id === product.id);
    return line && typeof product.stock === "number"
      ? { ...product, stock: product.stock - line.qty }
      : product;
  });

  const students = state.students.map((current) => {
    if (current.id !== studentId) return current;
    let next: Student = {
      ...current,
      coins: current.coins - totalCost,
      coinsSpent: (current.coinsSpent ?? 0) + totalCost,
    };
    const bag = [...(current.bag ?? [])];
    const inventory = [...(current.inventory ?? [])];
    for (const { item, qty } of resolved) {
      if (item.kind === "cosmetic") {
        if (!inventory.includes(item.id)) inventory.push(item.id);
        next = equipOn(next, item);
      } else {
        const index = bag.findIndex((entry) => entry.itemId === item.id);
        if (index >= 0) bag[index] = { ...bag[index], qty: bag[index].qty + qty };
        else bag.push({ itemId: item.id, qty, receivedQty: 0 });
      }
    }
    return { ...next, inventory, bag };
  });

  return {
    success: true,
    state: { ...state, students, products, orders: [...newOrders, ...state.orders] },
    totalCost,
    orderIds,
    alreadyApplied: false,
  };
}
