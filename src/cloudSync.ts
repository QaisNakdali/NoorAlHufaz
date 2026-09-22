import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

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

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

function isDataImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

async function uploadStudentPhoto(studentId: string, dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const contentType = blob.type || "image/jpeg";
  const extension = contentType.includes("webp") ? "webp" : "jpg";
  const path = `students/${studentId}.${extension}`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
    cacheControl: "86400",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** ينقل صور dataURL الحالية إلى Storage مرة واحدة ويعيد نسخة خفيفة للمزامنة. */
async function preparePayload(payload: CloudPayload): Promise<CloudPayload> {
  if (!payload.data || typeof payload.data !== "object") return payload;
  const state = payload.data as { students?: Array<{ id: string; photo?: string | null; [key: string]: unknown }>; [key: string]: unknown };
  if (!Array.isArray(state.students) || !state.students.some((s) => isDataImage(s.photo))) return payload;

  const students = await Promise.all(state.students.map(async (student) => {
    if (!isDataImage(student.photo)) return student;
    const photo = await uploadStudentPhoto(student.id, student.photo);
    return { ...student, photo };
  }));
  return { ...payload, data: { ...state, students } };
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
export async function cloudSave(payload: CloudPayload): Promise<CloudPayload> {
  const prepared = await preparePayload(payload);
  const row = {
    id: STATE_ID,
    rev: prepared.rev,
    data: prepared.data,
    updated_at: new Date().toISOString(),
  };

  // تحديث ذري: لا يمكن لطلب قديم وصل متأخرًا أن يستبدل نسخة أحدث.
  const { data: updated, error: updateError } = await supabase
    .from(STATE_TABLE)
    .update(row)
    .eq("id", STATE_ID)
    .lt("rev", prepared.rev)
    .select("rev,data")
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return prepared;

  // إذا لم يوجد الصف بعد، نحاول إنشاءه. تعارض الإنشاء يعني أن جهازًا آخر سبقنا.
  const { error: insertError } = await supabase.from(STATE_TABLE).insert(row);
  if (!insertError) return prepared;
  if (insertError.code !== "23505") throw insertError;

  // نسختنا رُفضت لأنها أقدم؛ نعيد النسخة الفائزة كي يطبقها الجهاز محليًا.
  const latest = await cloudLoad();
  return latest ?? prepared;
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
