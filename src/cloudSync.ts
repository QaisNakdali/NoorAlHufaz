/* ══════════════════════════════════════════════════════════════════════
   المزامنة السحابية — Sync Layer
   ══════════════════════════════════════════════════════════════════════

   ▐  الخطوة الوحيدة المطلوبة منك: ضع رابط API الخاص بك في CLOUD_URL أدناه

   الطريقة الأسهل (JSONBin — مجاني):
     ١) أنشئ حسابًا مجانيًا في https://jsonbin.io
     ٢) من لوحة التحكم أنشئ Bin جديدًا واكتب داخله: {}
     ٣) انسخ رابط الـ Bin، شكله هكذا:
        https://api.jsonbin.io/v3/b/665f1c2eabc123def4567890
     ٤) الصقه في CLOUD_URL وضع مفتاح الـ Master Key في CLOUD_HEADERS

   بدائل تعمل أيضًا: npoint.io · Firebase Realtime DB (REST) · أي خدمة
   JSON بسيطة تدعم القراءة بالكتابة على رابط واحد.

   ▐  اترك CLOUD_URL فارغًا = يعمل التطبيق بالحفظ المحلي فقط (كما كان).

   ملاحظات:
   - المزامنة تلقائية: كل تعديل يُرفع خلال ثانيتين تقريبًا، وكل جهاز
     يسحب أحدث نسخة كل CLOUD_PULL_INTERVAL_SEC ثانية.
   - آخر تعديل يفوز (Last-Write-Wins) — مناسب لأن المعلم عادةً الوحيد
     الذي يعدّل في اللحظة نفسها.
   - الباقة المجانية في JSONBin حجمها ١٠٠KB تقريبًا، وصور الطلاب هي أكبر
     جزء. إن ظهرت أخطاء حجم، فعّل CLOUD_SKIP_PHOTOS بالأسفل.
   ══════════════════════════════════════════════════════════════════════ */

/* ────────────── ضع رابطك هنا ────────────── */
export const CLOUD_URL = "https://api.jsonbin.io/v3/b/6a9845b5da38895dfe301732";

/* رؤوس الطلب — ضع هنا مفتاح JSONBin (X-Master-Key) إن كان مطلوبًا */
export const CLOUD_HEADERS: Record<string, string> = {
  "X-Master-Key": "$2a$10$ye4iE7eu0edA.xBwFOWMqOU0FF2.CGxdGEMT/bQg4Wq9h8/atioou",
};

/* فعّلها (true) إن تجاوزت بياناتك حد الخدمة المجانية:
   الصور تبقى محفوظة على كل جهاز محليًا ولا تُرفع للسحابة */
export const CLOUD_SKIP_PHOTOS = false;

/* كل كم ثانية يسحب كل جهاز أحدث نسخة من السحابة؟ */
export const CLOUD_PULL_INTERVAL_SEC = 20;

/* ────────────── ما بعد هذا السطر لا يحتاج تعديلًا ────────────── */
export const isCloudEnabled = (): boolean => true;

export type CloudPayload = { rev: number; data: unknown };

const isJsonBin = /jsonbin\.io/i.test(CLOUD_URL);

function errMsg(e: unknown): string {
  if (e instanceof DOMException && e.name === "AbortError") return "انتهت مهلة الاتصال";
  if (e instanceof Error) return e.message;
  return String(e);
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 12000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

/** جلب أحدث نسخة من السحابة — تعيد null إذا كان المستودع فارغًا */
export async function cloudLoad(): Promise<CloudPayload | null> {
  // إلغاء السحب إذا كان التابلت مقفلاً أو المتصفح بالخلفية توفيراً للباقة
  if (typeof document !== "undefined" && document.hidden) {
    return null;
  }

  const res = await request(isJsonBin ? `${CLOUD_URL}/latest` : CLOUD_URL, {
    method: "GET",
    headers: { ...CLOUD_HEADERS, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  // فكّ الأغلفة الشائعة: JSONBin يعيد {record} وبعض الخدمات تعيد {data}
  const payload = (isJsonBin ? json.record : json.record ?? json.data ?? json) as CloudPayload | null;
  if (!payload || typeof payload !== "object" || typeof payload.rev !== "number" || !("data" in payload)) {
    return null; // مستودع فارغ أو بصيغة غير متوقعة
  }
  return payload;
}

/** رفع نسخة كاملة إلى السحابة */
export async function cloudSave(payload: CloudPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const headers = { ...CLOUD_HEADERS, "Content-Type": "application/json" };
  let res = await request(CLOUD_URL, { method: "PUT", headers, body });
  if (!res.ok && !isJsonBin) {
    // بعض الخدمات لا تدعم PUT — نجرّب POST
    res = await request(CLOUD_URL, { method: "POST", headers, body });
  }
  if (!res.ok) {
    const hint = res.status === 413 || res.status === 402 ? " — الحجم تجاوز حد الخدمة، جرّب تفعيل CLOUD_SKIP_PHOTOS" : "";
    throw new Error(`HTTP ${res.status}${hint}`);
  }
}

export { errMsg };