import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar } from "../core";
import { BigBtn, Icon, Modal, SectionHead } from "./ui";

export default function Lessons() {
  const { lessons, addLesson, completeLesson } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [teacher, setTeacher] = useState("");
  const ordered = useMemo(
    () => [...lessons].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [lessons]
  );
  const nextLesson = ordered.find((lesson) => lesson.completedAt === null);

  const save = () => {
    if (!title.trim() || !teacher.trim()) return;
    addLesson(title, teacher);
    setTitle("");
    setTeacher("");
    setOpen(false);
  };

  return (
    <div className="anim-fade">
      <SectionHead
        icon="book"
        title="الدروس"
        desc="أضف الدروس بالترتيب، وسيظهر أول درس لم يُعطَ بعد في الكشف تلقائيًا."
        extra={
          <BigBtn onClick={() => setOpen(true)}>
            <Icon name="plus" className="h-5 w-5" strokeWidth={3} />
            إضافة درس جديد
          </BigBtn>
        }
      />

      <div className="mb-5 rounded-2xl border border-gold-500/40 bg-gradient-to-l from-gold-400/20 to-white p-5">
        <p className="text-xs font-extrabold text-gold-600">الدرس القادم</p>
        {nextLesson ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-extrabold text-ink">{nextLesson.title}</h3>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-grape-600">المعلم: {nextLesson.teacher}</span>
          </div>
        ) : (
          <p className="mt-2 font-bold text-grape-500">لا يوجد درس قادم حاليًا</p>
        )}
      </div>

      {ordered.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/70 p-14 text-center">
          <Icon name="book" className="mx-auto h-10 w-10 text-grape-300" strokeWidth={1.8} />
          <p className="mt-3 font-display text-lg font-extrabold text-grape-600">لم تُضف دروس بعد</p>
          <p className="mt-1 text-sm text-grape-500">أضف أول درس ليظهر في الكشف.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((lesson, index) => {
            const completed = lesson.completedAt !== null;
            const isNext = nextLesson?.id === lesson.id;
            return (
              <article key={lesson.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 shadow-[0_14px_38px_-34px_rgba(55,29,104,.55)] ${isNext ? "border-gold-500/60 ring-2 ring-gold-400/15" : "border-grape-100"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${completed ? "bg-mint-400/15 text-mint-600" : "bg-grape-100 text-grape-600"}`}>{ar(index + 1)}</span>
                <div className="min-w-44 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-extrabold text-ink sm:text-lg">{lesson.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${completed ? "bg-mint-400/15 text-mint-600" : isNext ? "bg-gold-400/25 text-gold-600" : "bg-grape-100 text-grape-600"}`}>
                      {completed ? "تم إعطاء الدرس" : isNext ? "الدرس القادم" : "قادم"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-grape-500">المعلم: {lesson.teacher}</p>
                </div>
                {!completed && (
                  <button type="button" onClick={() => completeLesson(lesson.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-mint-600 px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-105 active:scale-95">
                    <Icon name="check" className="h-4 w-4" strokeWidth={3} />
                    تم إعطاء الدرس
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-extrabold text-ink">إضافة درس جديد</h3>
              <p className="mt-1 text-sm text-grape-500">سيُضاف في نهاية ترتيب الدروس الحالي.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-grape-50 text-grape-500" aria-label="إغلاق">×</button>
          </div>
          <label className="block text-sm font-extrabold text-grape-700">
            عنوان الدرس
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: آداب طالب العلم" className="field-control mt-2 w-full" />
          </label>
          <label className="mt-4 block text-sm font-extrabold text-grape-700">
            اسم المعلم الذي سيقدم الدرس
            <input value={teacher} onChange={(event) => setTeacher(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }} placeholder="مثال: أبو بكر" className="field-control mt-2 w-full" />
          </label>
          <BigBtn onClick={save} disabled={!title.trim() || !teacher.trim()} className="mt-6 w-full">
            <Icon name="check" className="h-5 w-5" strokeWidth={3} />
            حفظ الدرس
          </BigBtn>
        </div>
      </Modal>
    </div>
  );
}
