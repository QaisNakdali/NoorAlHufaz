import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, type Lesson } from "../core";
import { BigBtn, Icon, Modal, SectionHead } from "./ui";

type Editor = { id: string | null; title: string; teacher: string };

export default function Lessons() {
  const { lessons, nextLessonId, lastCompletedLessonId, addLesson, completeLesson, undoLastLessonCompletion, setNextLesson, updateLesson, removeLesson } = useApp();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<Lesson | null>(null);
  const ordered = useMemo(() => [...lessons].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt), [lessons]);
  const nextLesson = ordered.find((lesson) => lesson.id === nextLessonId && lesson.completedAt === null) ?? ordered.find((lesson) => lesson.completedAt === null);
  const save = () => {
    if (!editor?.title.trim() || !editor.teacher.trim()) return;
    if (editor.id) updateLesson(editor.id, editor.title, editor.teacher); else addLesson(editor.title, editor.teacher);
    setEditor(null);
  };

  return <div className="anim-fade">
    <SectionHead icon="book" title="الدروس" desc="أضف الدروس بالترتيب، أو اختر أي درس غير مكتمل ليكون التالي دون تغيير ترتيبه الأصلي." extra={<BigBtn onClick={() => setEditor({ id: null, title: "", teacher: "" })}><Icon name="plus" className="h-5 w-5" strokeWidth={3}/>إضافة درس جديد</BigBtn>}/>
    <div className="mb-5 rounded-2xl border border-gold-500/40 bg-gradient-to-l from-gold-400/20 to-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-gold-600">الدرس القادم</p>{nextLesson ? <div className="mt-2 flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-extrabold text-ink">{nextLesson.title}</h3><span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-grape-600">المعلم: {nextLesson.teacher}</span></div> : <p className="mt-2 font-bold text-grape-500">لا يوجد درس قادم حاليًا</p>}</div><button type="button" disabled={!lastCompletedLessonId} onClick={undoLastLessonCompletion} className="rounded-xl border-2 border-grape-200 bg-white px-4 py-2 text-sm font-extrabold text-grape-600 disabled:opacity-35"><Icon name="refresh" className="ms-1 inline h-4 w-4"/>عودة عن آخر إعطاء</button></div>
    </div>
    {ordered.length === 0 ? <div className="dashed-border rounded-3xl bg-white/70 p-14 text-center"><Icon name="book" className="mx-auto h-10 w-10 text-grape-300"/><p className="mt-3 font-display text-lg font-extrabold text-grape-600">لم تُضف دروس بعد</p></div> : <div className="space-y-3">{ordered.map((lesson, index) => {
      const completed = lesson.completedAt !== null;
      const isNext = nextLesson?.id === lesson.id;
      return <article key={lesson.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 ${isNext ? "border-gold-500/60 ring-2 ring-gold-400/15" : "border-grape-100"}`}><span className={`grid h-10 w-10 place-items-center rounded-xl font-display text-sm font-extrabold ${completed ? "bg-mint-400/15 text-mint-600" : "bg-grape-100 text-grape-600"}`}>{ar(index + 1)}</span><div className="min-w-44 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-base font-extrabold text-ink sm:text-lg">{lesson.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${completed ? "bg-mint-400/15 text-mint-600" : isNext ? "bg-gold-400/25 text-gold-600" : "bg-grape-100 text-grape-600"}`}>{completed ? "تم إعطاء الدرس" : isNext ? "الدرس القادم" : "قادم"}</span></div><p className="mt-1 text-sm font-bold text-grape-500">المعلم: {lesson.teacher}</p></div><div className="flex flex-wrap gap-2">{!completed && !isNext && <button type="button" onClick={() => setNextLesson(lesson.id)} className="rounded-xl bg-gold-100 px-3 py-2 text-xs font-extrabold text-gold-700">اجعله الدرس التالي</button>}{!completed && <button type="button" onClick={() => completeLesson(lesson.id)} className="rounded-xl bg-mint-600 px-3 py-2 text-xs font-extrabold text-white">تم إعطاء الدرس</button>}<button type="button" onClick={() => setEditor({ id: lesson.id, title: lesson.title, teacher: lesson.teacher })} className="rounded-xl bg-grape-100 px-3 py-2 text-xs font-extrabold text-grape-600">تعديل</button><button type="button" onClick={() => setDeleting(lesson)} className="rounded-xl bg-coral-50 px-3 py-2 text-xs font-extrabold text-coral-600">حذف</button></div></article>;
    })}</div>}
    <Modal open={!!editor} onClose={() => setEditor(null)}><div className="p-6"><h3 className="font-display text-xl font-extrabold text-ink">{editor?.id ? "تعديل الدرس" : "إضافة درس جديد"}</h3><label className="mt-5 block text-sm font-extrabold text-grape-700">عنوان الدرس<input autoFocus value={editor?.title ?? ""} onChange={(e) => setEditor((v) => v ? { ...v, title: e.target.value } : v)} className="field-control mt-2 w-full"/></label><label className="mt-4 block text-sm font-extrabold text-grape-700">اسم المعلم<input value={editor?.teacher ?? ""} onChange={(e) => setEditor((v) => v ? { ...v, teacher: e.target.value } : v)} onKeyDown={(e) => e.key === "Enter" && save()} className="field-control mt-2 w-full"/></label><div className="mt-6 flex gap-2"><BigBtn onClick={save} disabled={!editor?.title.trim() || !editor.teacher.trim()} className="flex-1">حفظ</BigBtn><button onClick={() => setEditor(null)} className="rounded-xl border-2 border-grape-200 px-4 font-bold text-grape-500">إلغاء</button></div></div></Modal>
    <Modal open={!!deleting} onClose={() => setDeleting(null)}><div className="p-6 text-center"><h3 className="font-display text-xl font-extrabold text-ink">هل أنت متأكد من حذف هذا الدرس؟</h3><p className="mt-2 font-bold text-grape-500">{deleting?.title}</p><div className="mt-6 flex gap-2"><button onClick={() => { if (deleting) removeLesson(deleting.id); setDeleting(null); }} className="flex-1 rounded-xl bg-coral-500 px-4 py-3 font-extrabold text-white">حذف</button><button onClick={() => setDeleting(null)} className="flex-1 rounded-xl border-2 border-grape-200 px-4 py-3 font-extrabold text-grape-500">إلغاء</button></div></div></Modal>
  </div>;
}
