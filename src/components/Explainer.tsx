import { useState } from "react";
import { Icon, Modal } from "./ui";

const SLIDES = [
  { icon: "🏆", title: "مسابقة الأسبوع", body: "مسابقة تحفيزية ترافق الطالب خلال الأسبوع وتشجعه على الحضور والحفظ والمراجعة وحسن السلوك، دون مقارنة سلبية بين الطلاب.", points: ["تقدير الاستمرار", "تعزيز العادات الجيدة", "احتفال أسبوعي ممتع"] },
  { icon: "🪙", title: "كيف يحصل الطالب على العملات؟", body: "يجمع الطالب العملات من أعماله المسجلة فعليًا، ويحدد المعلم قيمة جوائز الحفل قبل بدايته.", points: ["الحضور", "تسميع الحفظ والمراجعة", "السلوك والرحلات والجوائز"] },
  { icon: "🏆", title: "أبطال الأسبوع", body: "يستحقها من أكمل جميع أيام الحضور وسمّع الحفظ والمراجعة وحافظ على قلوبه، وحضر الرحلة إن وُجدت.", points: ["الشروط واضحة للجميع", "الجائزة عملات فقط", "يمكن تعطيلها لأي أسبوع"] },
  { icon: "🚀", title: "الأكثر تطورًا", body: "تكافئ التحسن الحقيقي في أداء الطالب مقارنة بأدائه السابق، وليس التفوق على زملائه فقط.", points: ["كمية الحفظ والمراجعة", "الانتظام في التسميع", "الحضور واستقرار الأداء"] },
  { icon: "⭐", title: "أفضل سلوك", body: "تشجع الهدوء والاحترام والتعاون والمحافظة على آداب الحلقة، ويختارها المعلم بناءً على متابعته.", points: ["الاحترام", "التعاون", "المحافظة على القلوب"] },
  { icon: "🎒", title: "الرحلات", body: "عند وجود رحلة يسجل المعلم الحاضرين، ويمكنه تفعيل جائزة عملات مستقلة وتحديد قيمتها.", points: ["اختيارية بالكامل", "لا توجد قيمة ثابتة", "لا تغيّر المستوى أو القلوب"] },
  { icon: "💰", title: "العملات والمكافآت", body: "يستخدم الطالب العملات داخل متجر الحلقة لشراء الهدايا وخصائص ملفه، فيتعلم الادخار والاختيار.", points: ["رصيد واضح", "متجر تحفيزي", "الجوائز تتجمع إذا فاز بأكثر من فئة"] },
  { icon: "📈", title: "هدفنا", body: "بناء علاقة إيجابية ومستدامة مع حفظ القرآن، مع إبقاء القرار التربوي بيد المعلم.", points: ["الاستمرار", "المراجعة والثبات", "التنافس الإيجابي"] },
] as const;

export default function ExplainerModal({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  return <Modal open onClose={onClose} wide>
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-white via-grape-50 to-gold-50 p-5 sm:p-8">
      <div className="flex items-center justify-between"><span className="rounded-full bg-grape-100 px-3 py-1 text-xs font-extrabold text-grape-600">دليل أولياء الأمور · {index + 1} / {SLIDES.length}</span><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white text-grape-600 shadow"><Icon name="x" className="h-5 w-5" /></button></div>
      <div className="mx-auto mt-6 max-w-2xl text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] bg-gradient-to-br from-grape-600 to-grape-800 text-5xl shadow-xl">{slide.icon}</div><h2 className="mt-5 font-display text-3xl font-extrabold text-ink sm:text-4xl">{slide.title}</h2><p className="mx-auto mt-3 max-w-xl text-base font-bold leading-8 text-grape-700/80">{slide.body}</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{slide.points.map((point) => <div key={point} className="rounded-2xl border-2 border-grape-100 bg-white px-3 py-4 text-sm font-extrabold text-grape-700 shadow-sm">✓ {point}</div>)}</div></div>
      <div className="mt-8 h-2 overflow-hidden rounded-full bg-grape-100"><div className="h-full rounded-full bg-gradient-to-l from-gold-400 to-grape-600 transition-all" style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }} /></div>
      <div className="mt-5 flex items-center justify-between gap-3"><button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="rounded-2xl border-2 border-grape-200 bg-white px-5 py-3 font-display text-sm font-extrabold text-grape-600 disabled:opacity-35">السابق</button><div className="flex gap-1">{SLIDES.map((_, i) => <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`الشريحة ${i + 1}`} className={`h-2.5 rounded-full transition-all ${i === index ? "w-7 bg-grape-600" : "w-2.5 bg-grape-200"}`} />)}</div>{index === SLIDES.length - 1 ? <button type="button" onClick={onClose} className="rounded-2xl bg-grape-600 px-5 py-3 font-display text-sm font-extrabold text-white">العودة للموقع</button> : <button type="button" onClick={() => setIndex((i) => i + 1)} className="rounded-2xl bg-grape-600 px-5 py-3 font-display text-sm font-extrabold text-white">التالي</button>}</div>
    </div>
  </Modal>;
}
