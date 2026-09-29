import test from "node:test";
import assert from "node:assert/strict";
import { externalizeDataImages } from "../src/cloudPayload.ts";

test("ينقل الصورة المضمّنة مرة واحدة ويحافظ على جميع السجلات والمراجع", async () => {
  const image = "data:image/jpeg;base64,AAAA";
  let uploads = 0;
  const original = {
    products: [{ id: "p1", image }],
    orders: [{ id: "o1", itemImage: image }, { id: "o2", itemImage: image }],
    students: [{ id: "s1", name: "أحمد" }],
  };

  const result = await externalizeDataImages(original, async () => {
    uploads += 1;
    return "https://storage.example/assets/image.jpg";
  }) as typeof original;

  assert.equal(uploads, 1);
  assert.equal(result.products[0].image, "https://storage.example/assets/image.jpg");
  assert.equal(result.orders[0].itemImage, result.products[0].image);
  assert.equal(result.orders[1].itemImage, result.products[0].image);
  assert.deepEqual(result.students, original.students);
  assert.equal(result.orders.length, original.orders.length);
});

test("فشل رفع صورة لا يحذفها ولا يستبدلها بفراغ", async () => {
  const image = "data:image/png;base64,BBBB";
  const result = await externalizeDataImages({ image }, async () => {
    throw new Error("quota");
  }) as { image: string };
  assert.equal(result.image, image);
});

test("الحالة الخالية من الصور المضمّنة تعاد كما هي دون نسخ أو رفع", async () => {
  const original = { products: [{ id: "p1", image: "https://storage.example/image.jpg" }] };
  const result = await externalizeDataImages(original, async () => {
    throw new Error("يجب ألا يُستدعى الرفع");
  });
  assert.equal(result, original);
});
