import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { externalizeDataImages } from "./cloudPayload";

/*
  مزامنة Supabase اللحظية.
  مفتاح anon مفتاح عام مصمم للاستخدام في المتصفح؛ الحماية الفعلية تطبقها RLS.
*/
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://inkxxpomafiwygzhohwr.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlua3h4cG9tYWZpd3lnemhvaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5Mjc5MzcsImV4cCI6MjEwNTUwMzkzN30.9F1VB43lKUFWRQqDlOFdZWN9Qi3wnap17Z3JNZ8trxY";

const STATE_TABLE = "app_state";
const STATE_ID = "noor_al_hufaz_main";
const PHOTOS_BUCKET = "student-photos";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export const CLOUD_SKIP_PHOTOS = false;
export const isCloudEnabled = (): boolean => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export type CloudPayload = { rev: number; data: unknown };
export type CloudSaveResult = CloudPayload & { applied: boolean };

function errMsg(e: unknown): string {
  if (!e) return "حدث خطأ غير محدد";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error_description === "string" && obj.error_description) return obj.error_description;
    if (typeof obj.details === "string" && obj.details) return obj.details;
  }
  return "حدث خطأ في المزامنة";
}

async function dataUrlHash(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadEmbeddedImage(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const contentType = blob.type || "image/jpeg";
  const extension = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
  const hash = await dataUrlHash(dataUrl);
  const path = `assets/${hash.slice(0, 40)}.${extension}`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
    cacheControl: "31536000",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${hash.slice(0, 12)}`;
}

/** ينقل جميع صور dataURL إلى Storage مرة واحدة ويعيد نسخة خفيفة للمزامنة. */
async function preparePayload(payload: CloudPayload): Promise<CloudPayload> {
  if (!payload.data || typeof payload.data !== "object") return payload;
  const data = await externalizeDataImages(payload.data, uploadEmbeddedImage);
  return { ...payload, data };
}

export async function cloudLoad(): Promise<CloudPayload | null> {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select("rev,data")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { rev: Number(data.rev) || 0, data: data.data };
}

/** يحفظ الحالة ويعيدها بعد نقل الصور إلى Storage إن وجدت. */
export async function cloudSave(payload: CloudPayload, expectedRev: number): Promise<CloudSaveResult> {
  const prepared = await preparePayload(payload);
  const row = {
    id: STATE_ID,
    rev: prepared.rev,
    data: prepared.data,
    updated_at: new Date().toISOString(),
  };

  // مقارنة وتبديل ذرية: لا يُسمح بالحفظ إلا إذا بُني التعديل على النسخة الحالية نفسها.
  // هذا يمنع جهازًا يحمل حالة قديمة من استبدال بيانات أحدث لمجرد أن ساعته أعطت رقمًا أكبر.
  const { data: updated, error: updateError } = await supabase
    .from(STATE_TABLE)
    .update(row)
    .eq("id", STATE_ID)
    .eq("rev", expectedRev)
    .select("rev,data")
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return { ...prepared, applied: true };

  // إذا لم يوجد الصف بعد، نحاول إنشاءه. تعارض الإنشاء يعني أن جهازًا آخر سبقنا.
  const { error: insertError } = await supabase.from(STATE_TABLE).insert(row);
  if (!insertError) return { ...prepared, applied: true };
  if (insertError.code !== "23505") throw insertError;

  // حدث تعديل متزامن؛ نعيد النسخة الفائزة كي يدمج المتصل تغييره فوقها ثم يعيد المحاولة.
  const latest = await cloudLoad();
  return latest ? { ...latest, applied: false } : { ...prepared, applied: false };
}

/** يستقبل تعديل أي معلم فور وصوله إلى قاعدة البيانات. */
export function subscribeCloud(onPayload: (payload: CloudPayload) => void): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel("noor-al-hufaz-live")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: STATE_TABLE,
      filter: `id=eq.${STATE_ID}`,
    }, (event) => {
      const row = event.new as { rev?: number | string; data?: unknown };
      if (row && row.data !== undefined) onPayload({ rev: Number(row.rev) || 0, data: row.data });
    })
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}

export { errMsg };
