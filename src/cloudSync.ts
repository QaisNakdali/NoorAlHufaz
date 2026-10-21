import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { externalizeDataImages } from "./cloudPayload";
import { cacheImageUploads } from "./imageUploadCache";
import { buildCloudPatch } from "./cloudPatch";
import { applyLiveDelta, type LiveDelta } from "./liveDelta";

/*
  مزامنة Supabase اللحظية.
  مفتاح anon مفتاح عام مصمم للاستخدام في المتصفح؛ الحماية الفعلية تطبقها RLS.
*/
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://inkxxpomafiwygzhohwr.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlua3h4cG9tYWZpd3lnemhvaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5Mjc5MzcsImV4cCI6MjEwNTUwMzkzN30.9F1VB43lKUFWRQqDlOFdZWN9Qi3wnap17Z3JNZ8trxY";const STATE_TABLE = "app_state";
const productionStateId = import.meta.env.VITE_SUPABASE_STATE_ID || "noor_al_hufaz_main";
const isExplicitPreviewBenchmark = typeof window !== "undefined"
  && window.location.hostname !== "noor-al-hufaz-main.vercel.app"
  && new URLSearchParams(window.location.search).get("checkoutBenchmark") === "1";
// صف مستقل لا يحتوي أي بيانات طلاب حقيقية، ويعمل فقط في روابط المعاينة الصريحة.
const STATE_ID = isExplicitPreviewBenchmark ? "noor_checkout_benchmark_v1" : productionStateId;
export const CLOUD_STATE_SCOPE = `${SUPABASE_URL}/${STATE_ID}`;
const PHOTOS_BUCKET = "student-photos";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export const CLOUD_SKIP_PHOTOS = false;
export const isCloudEnabled = (): boolean => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export type CloudPayload = { rev: number; data: unknown };export type CloudSaveResult = CloudPayload & { applied: boolean; networkRequests: number };

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

const uploadImageOnce = cacheImageUploads(uploadEmbeddedImage);

/** ينقل صور dataURL مع إعادة استخدام الرفع الناجح دون حذف الأصل. */
async function preparePayload(payload: CloudPayload): Promise<CloudPayload> {
  if (!payload.data || typeof payload.data !== "object") return payload;
  const data = await externalizeDataImages(payload.data, uploadImageOnce);
  return { ...payload, data };
}

let serverSnapshot: CloudPayload | null = null;
function rememberSnapshot(snapshot: CloudPayload): CloudPayload {
  if (!serverSnapshot || snapshot.rev >= serverSnapshot.rev) serverSnapshot = snapshot;
  return snapshot;
}
let loadInFlight: Promise<CloudPayload | null> | null = null;
export function cloudLoad(): Promise<CloudPayload | null> {
  if (!loadInFlight) loadInFlight = readCloud().finally(() => { loadInFlight = null; });
  return loadInFlight;
}
async function readCloud(): Promise<CloudPayload | null> {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select("rev,data")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rememberSnapshot({ rev: Number(data.rev) || 0, data: data.data });
}

/** الحفظ العادي يستخدم فرقًا مبنيًا على نسخة المراجعة نفسها، مثل الشراء. */
export async function cloudSave(payload: CloudPayload, expectedRev: number, before?: unknown): Promise<CloudSaveResult> {
  return cloudSaveCompact(payload, expectedRev, before);
}

/**
 * نسخة خفيفة من الحفظ الذري للعمليات الحساسة السريعة (مثل الشراء).
 * عند النجاح تعيد قاعدة البيانات رقم المراجعة فقط، بينما تبقى البيانات المحضرة
 * محليًا لتطبيقها فورًا. لا نحمّل JSON الكامل مرة أخرى إلا عند تعارض حقيقي.
 */
let patchAvailable = true;
export async function cloudSaveCompact(payload: CloudPayload, expectedRev: number, before?: unknown): Promise<CloudSaveResult> {
  const prepared = await preparePayload(payload);
  if (patchAvailable && before) {
    const patch = buildCloudPatch(before, prepared.data);
    if (patch.length <= 2000) {
      const { data, error } = await supabase.rpc("noor_apply_patch", {
        p_state_id: STATE_ID, p_expected_rev: expectedRev, p_next_rev: expectedRev + 1, p_patch: patch,
      });
      if (!error) {
        if (data?.applied) return { ...rememberSnapshot({ ...prepared, rev: Number(data.rev) }), applied: true, networkRequests: 1 };
        const latest = await cloudLoad();
        if (!latest) throw new Error("تعذر العثور على بيانات الموقع؛ لم يتم تأكيد الشراء");
        return { ...latest, applied: false, networkRequests: 2 };
      }
      if (error.code !== "PGRST202" && error.code !== "42883") throw error;
      patchAvailable = false; // Missing function only: ambiguous failures must retain the operation ID.
    }
  }
  const row = {
    id: STATE_ID,
    rev: prepared.rev,
    data: prepared.data,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from(STATE_TABLE)
    .update(row)
    .eq("id", STATE_ID)
    .eq("rev", expectedRev)
    .select("rev")
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return { ...rememberSnapshot({ ...prepared, rev: Number(updated.rev) || prepared.rev }), applied: true, networkRequests: 1 };

  const { error: insertError } = await supabase.from(STATE_TABLE).insert(row);
  if (!insertError) return { ...rememberSnapshot(prepared), applied: true, networkRequests: 2 };
  if (insertError.code !== "23505") throw insertError;

  const latest = await cloudLoad();
  return latest ? { ...latest, applied: false, networkRequests: 3 } : { ...prepared, applied: false, networkRequests: 3 };
}

/** Server deltas preserve instant updates without transferring the full archive. */
export function subscribeCloud(onPayload: (payload: CloudPayload) => void): () => void {
  let disposed = false;
  let chain = Promise.resolve();
  const enqueue = (task: () => Promise<void>) => {
    chain = chain.then(async () => { if (!disposed) await task(); }).catch(() => {});
  };
  const recover = async () => {
    const snapshot = await cloudLoad();
    if (!disposed && snapshot) onPayload(snapshot);
  };
  const checkRevision = async () => {
    if (disposed || document.visibilityState === "hidden") return;
    const { data, error } = await supabase.from(STATE_TABLE).select("rev").eq("id", STATE_ID).maybeSingle();
    if (error) throw error;
    if (data && (!serverSnapshot || Number(data.rev) !== serverSnapshot.rev)) await recover();
  };
  let channel: RealtimeChannel | null = supabase
    .channel(`noor-delta:${STATE_ID}`, { config: { private: false } })
    .on("broadcast", { event: "state_delta" }, ({ payload }) => {
      enqueue(async () => {
        const next = applyLiveDelta(serverSnapshot, payload as LiveDelta);
        if (!next) { await recover(); return; }
        if (next !== serverSnapshot) {
          rememberSnapshot(next);
          if (!disposed) onPayload(next);
        }
      });
    })
    .subscribe((status) => {
      // Join/rejoin before reconciliation: recover any event missed during connection.
      if (status === "SUBSCRIBED") enqueue(checkRevision);
    });
  const onVisible = () => { if (document.visibilityState !== "hidden") enqueue(checkRevision); };
  const onOnline = () => enqueue(checkRevision);
  const timer = window.setInterval(() => enqueue(checkRevision), 60000);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  return () => {
    disposed = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}

export { errMsg };
