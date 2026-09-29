import assert from "node:assert/strict";
import test from "node:test";
import { applyCheckoutTransaction, HEART_ITEM_ID } from "../src/checkoutTransaction.ts";
import { seedStudents, type ShopItem } from "../src/core.ts";

const product: ShopItem = {
  id: "limited",
  name: "هدية محدودة",
  desc: "",
  price: 40,
  minLevel: 1,
  icon: "gift",
  kind: "physical",
  repeatable: true,
  stock: 1,
};

function state() {
  const first = { ...seedStudents()[0], coins: 100, coinsSpent: 0, bag: [], inventory: [] };
  const second = { ...seedStudents()[1], coins: 100, coinsSpent: 0, bag: [], inventory: [] };
  return { parentStoreOpen: true, heartPrice: 40, students: [first, second], products: [product], orders: [] };
}

test("الشراء يخصم العملات والمخزون وينشئ طلبًا كوحدة واحدة", () => {
  const initial = state();
  const result = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: product.id, qty: 1 }], "request-a", "2026-09-29T00:00:00.000Z");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.state.students[0].coins, 60);
  assert.equal(result.state.products[0].stock, 0);
  assert.equal(result.state.orders.length, 1);
  assert.equal(result.state.orders[0].quantity, 1);
});

test("قطعة واحدة لا يمكن أن تنجح لطالبين", () => {
  const initial = state();
  const first = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: product.id, qty: 1 }], "request-a", "2026-09-29T00:00:00.000Z");
  assert.equal(first.success, true);
  if (!first.success) return;
  const second = applyCheckoutTransaction(first.state, initial.students[1].id, [{ itemId: product.id, qty: 1 }], "request-b", "2026-09-29T00:00:01.000Z");
  assert.equal(second.success, false);
  assert.match(second.success ? "" : second.error, /لم تعد تكفي/);
  assert.equal(first.state.students[1].coins, 100);
});

test("إعادة نفس requestId لا تخصم العملات مرتين", () => {
  const initial = state();
  const first = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: product.id, qty: 1 }], "same-request", "2026-09-29T00:00:00.000Z");
  assert.equal(first.success, true);
  if (!first.success) return;
  const retry = applyCheckoutTransaction(first.state, initial.students[0].id, [{ itemId: product.id, qty: 1 }], "same-request", "2026-09-29T00:00:02.000Z");
  assert.equal(retry.success, true);
  if (!retry.success) return;
  assert.equal(retry.alreadyApplied, true);
  assert.equal(retry.state.students[0].coins, 60);
  assert.equal(retry.state.orders.length, 1);
});

test("فشل الشراء لا يخصم شيئًا ولا ينشئ طلبًا", () => {
  const initial = state();
  initial.students[0].coins = 10;
  const result = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: product.id, qty: 1 }], "request-c", "2026-09-29T00:00:00.000Z");
  assert.equal(result.success, false);
  assert.equal(initial.students[0].coins, 10);
  assert.equal(initial.products[0].stock, 1);
  assert.equal(initial.orders.length, 0);
});

test("الطالب دون قلب لا يستطيع شراء منتج عادي", () => {
  const initial = state();
  initial.students[0].hearts = 0;
  const result = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: product.id, qty: 1 }], "no-heart", "2026-09-29T00:00:00.000Z");
  assert.equal(result.success, false);
  assert.match(result.success ? "" : result.error, /قلب/);
  assert.equal(initial.students[0].coins, 100);
  assert.equal(initial.products[0].stock, 1);
});

test("شراء القلب يخصم السعر الحالي ويرفع قلبًا واحدًا فقط", () => {
  const initial = state();
  initial.heartPrice = 25;
  initial.students[0].hearts = 0;
  const result = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: HEART_ITEM_ID, qty: 1 }], "heart-a", "2026-09-29T00:00:00.000Z");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.state.students[0].coins, 75);
  assert.equal(result.state.students[0].hearts, 1);
  assert.equal(result.state.orders[0].itemKind, "heart");
  assert.equal(result.state.orders[0].status, "delivered");
});

test("لا يسمح بشراء قلب عند اكتمال القلوب", () => {
  const initial = state();
  initial.students[0].hearts = 3;
  const result = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: HEART_ITEM_ID, qty: 1 }], "heart-full", "2026-09-29T00:00:00.000Z");
  assert.equal(result.success, false);
  assert.equal(initial.students[0].coins, 100);
});

test("خاصية البروفايل تُملَك وتُفعّل وتُسلّم فورًا", () => {
  const cosmetic: ShopItem = {
    id: "frame-test", name: "إطار اختباري", desc: "", price: 30, minLevel: 1,
    icon: "frame", kind: "cosmetic", slot: "frame", value: "gold", stock: 2,
  };
  const initial = state();
  initial.products = [cosmetic];
  const result = applyCheckoutTransaction(initial, initial.students[0].id, [{ itemId: cosmetic.id, qty: 1 }], "cosmetic-a", "2026-09-29T00:00:00.000Z");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.state.students[0].inventory, [cosmetic.id]);
  assert.equal(result.state.students[0].frame, "gold");
  assert.equal(result.state.orders[0].itemKind, "cosmetic");
  assert.equal(result.state.orders[0].status, "delivered");
  assert.equal(result.state.orders[0].deliveredAt, "2026-09-29T00:00:00.000Z");
});
