/* بوابة خاصة بأولياء الأمور — تصميم مودرن، فخم ومتجاوب بالكامل مع الجوال والحاسوب */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../appState";
import { analyzeStudentTrend, pagesForWardDay } from "../analytics";
import { ar, bagQty, DAYS, levelInfo, type ShopItem, type Student, uid } from "../core";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { Coin, HeartsRow, Icon } from "./ui";
import { formatHijriDate, addCalendarDays } from "../hijriDate";
import { roundUpToQuarter } from "../statisticsNumber";

const n = (value: number) => ar(roundUpToQuarter(value));

type CartItem = {
  id: string; // معرف فريد لكل عنصر في السلة لمنع حذف السلة بالكامل
  itemId: string;
  qty: number;
};

export default function ParentPortal({ token }: { token: string }) {
  const {
    students = [],
    halaqas = [],
    weeksLog = [],
    week = 1,
    weekStartDateIso = "",
    parentContacts = [],
    products = [],
    parentStoreOpen,
    orders = [],
    logParentAccess,
    checkoutParentCart,
    toast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"progress" | "store" | "purchases">("progress");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // البحث الدائم عن الطالب المطابق لرمز الوصول أو المعرف
  const student = useMemo(() => {
    if (!token || !token.trim()) return null;
    const cleanToken = token.trim();
    return students.find((s) => s.parentAccessToken === cleanToken || s.id === cleanToken) || null;
  }, [students, token]);

  const halaqa = useMemo(() => {
    if (!student?.halaqaId) return null;
    return halaqas.find((h) => h.id === student.halaqaId) || null;
  }, [student, halaqas]);

  const trend = useMemo(() => {
    if (!student) return null;
    return analyzeStudentTrend(student, weeksLog, parentContacts);
  }, [student, weeksLog, parentContacts]);

  // تسجيل جلسة النشاط عند الدخول
  useEffect(() => {
    if (student) {
      logParentAccess(student.id, activeTab === "store");
    }
  }, [student, activeTab, logParentAccess]);

  // حالة الرابط غير الصالح أو عند حذف الطالب
  if (!student) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="max-w-md w-full rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
            <Icon name="alert" className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-lg font-extrabold text-ink">
            رابط المتابعة غير متاح
          </h2>
          <p className="mt-2 text-xs font-bold text-slate-500 leading-relaxed">
            يرجى التواصل مع إدارة الحلقة أو معلم الطالب للحصول على الرابط المحدّث للطالب.
          </p>
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-bold text-slate-400">
            نور الحفّاظ &bull; منصة التحفيظ والمتابعة القرآنية
          </div>
        </div>
      </div>
    );
  }

  // حساب المستوى ودرجات التقدم بحماية تامة من أخطاء NaN
  const { level, into, need } = levelInfo(student.xp ?? 0);
  const safeLevel = level || 1;
  const safeInto = Number.isFinite(into) ? Math.max(0, into) : 0;
  const safeNeed = Number.isFinite(need) && need > 0 ? need : 100;
  const safePct = Math.min(100, Math.max(0, Math.round((safeInto / safeNeed) * 100)));

  // حسابات إحصائيات الأسبوع الحالي
  const currPresent = DAYS.filter((d) => !!student.days?.[d.key]?.a && !student.days?.[d.key]?.absent).length;
  const currAbsent = DAYS.filter((d) => student.days?.[d.key]?.absent === true).length;
  const totalDaysEvaluated = currPresent + currAbsent;
  const attendanceRate = totalDaysEvaluated > 0 ? Math.round((currPresent / totalDaysEvaluated) * 100) : 100;

  const memSessions = DAYS.filter((d) => {
    const st = student.days?.[d.key];
    const rt = student.recitationRatings?.[d.key];
    return !!st?.a && !st?.absent && (!!st?.h || rt?.h === "excellent" || rt?.h === "very-good");
  }).length;

  const revSessions = DAYS.filter((d) => {
    const st = student.days?.[d.key];
    const rt = student.recitationRatings?.[d.key];
    return !!st?.a && !st?.absent && (!!st?.r || rt?.r === "excellent" || rt?.r === "very-good");
  }).length;

  let memPages = 0;
  let revPages = 0;
  for (const d of DAYS) {
    const st = student.days?.[d.key];
    const rt = student.recitationRatings?.[d.key];
    if (st?.a && !st.absent && (st.h || rt?.h === "excellent" || rt?.h === "very-good")) {
      memPages += pagesForWardDay(student, d.key, "memorization").pages;
    }
    if (st?.a && !st.absent && (st.r || rt?.r === "excellent" || rt?.r === "very-good")) {
      revPages += pagesForWardDay(student, d.key, "review").pages;
    }
  }

  // ملخص الأسابيع السابقة المحفوظة
  const pastWeeksHistory = weeksLog
    .map((log) => {
      const record = log.records?.find((r) => r.id === student.id);
      const studentEntries = [...(Array.isArray(log.students) ? log.students : []), ...(Array.isArray(log.top) ? log.top : [])];
      const entry = studentEntries.find((e) => e.id === student.id);
      if (!record && !entry) return null;

      let pCount = entry?.attendanceDays ?? 0;
      let aCount = entry?.absenceDays ?? 0;
      let mPages = entry?.memorizationPages ?? 0;
      let rPages = entry?.reviewPages ?? 0;

      if (record) {
        pCount = DAYS.filter((d) => !!record.days?.[d.key]?.a && !record.days?.[d.key]?.absent).length;
        aCount = DAYS.filter((d) => record.days?.[d.key]?.absent === true).length;
        mPages = 0;
        rPages = 0;
        for (const d of DAYS) {
          const st = record.days?.[d.key];
          const rt = record.recitationRatings?.[d.key];
          if (st?.a && !st.absent && (st.h || rt?.h === "excellent" || rt?.h === "very-good")) {
            mPages += pagesForWardDay(record as unknown as Student, d.key, "memorization").pages;
          }
          if (st?.a && !st.absent && (st.r || rt?.r === "excellent" || rt?.r === "very-good")) {
            rPages += pagesForWardDay(record as unknown as Student, d.key, "review").pages;
          }
        }
      }

      return {
        week: log.week,
        weekName: log.name || `الأسبوع ${ar(log.week)}`,
        savedAt: log.savedAt,
        present: pCount,
        absent: aCount,
        memPages: mPages,
        revPages: rPages,
      };
    })
    .filter(Boolean) as {
    week: number;
    weekName: string;
    savedAt?: string;
    present: number;
    absent: number;
    memPages: number;
    revPages: number;
  }[];

  // طلبات الشراء للطالب
  const studentOrders = useMemo(() => {
    return orders.filter((o) => o.studentId === student.id);
  }, [orders, student.id]);

  // إضافة منتج للسلة مع دعم التكرار والكميات
  const addToCart = (product: ShopItem) => {
    if (student.coins < product.price) {
      toast("error", "رصيد العملات لا يكفي لشراء هذا المنتج");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id);
      if (existing) {
        if (!product.repeatable && product.kind !== "cosmetic") {
          toast("error", "هذا المنتج لا يمكن شراؤه أكثر من مرة");
          return prev;
        }
        toast("success", `تمت إضافة نسخة أخرى من «${product.name}» للسلة`);
        return prev.map((c) => (c.itemId === product.id ? { ...c, qty: c.qty + 1 } : c));
      }
      toast("success", `تمت إضافة «${product.name}» إلى السلة`);
      return [...prev, { id: uid(), itemId: product.id, qty: 1 }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((c) => c.id !== cartId && c.itemId !== cartId));
    toast("info", "تم حذف المنتج من السلة");
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => {
      const p = products.find((x) => x.id === c.itemId);
      return sum + (p ? p.price * c.qty : 0);
    }, 0);
  }, [cart, products]);

  const handleCheckout = () => {
    if (isSubmitting || cart.length === 0) return;
    if (student.coins < cartTotal) {
      toast("error", "رصيد عملات الطالب لا يكفي لإتمام الشراء");
      return;
    }

    setIsSubmitting(true);
    const checkoutItems = cart.map((c) => ({ itemId: c.itemId, qty: c.qty }));
    const res = checkoutParentCart(student.id, checkoutItems);
    setIsSubmitting(false);

    if (res.success) {
      setCart([]);
      setActiveTab("purchases");
    } else {
      toast("error", res.error || "تعذر إتمام العملية");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-ink pb-20" dir="rtl">
      {/* 1. الشريط العلوي — ناعم، فخم، وخالٍ من الحدود السوداء */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2.5 shadow-2xs">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl bg-grape-600 text-white font-black text-sm shadow-xs shrink-0">
              📖
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xs sm:text-sm font-extrabold text-ink leading-tight truncate">
                بوابة متابعة الطالب
              </h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate">نور الحفّاظ • متابعة حصرية لولي الأمر</p>
            </div>
          </div>
          <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-black text-grape-700 shrink-0">
            الأسبوع {ar(week)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-3.5">
        {/* 2. بطاقة الطالب العلوية (Hero Card) — مدمجة، فخمة، وبسطر إحصائيات ثلاثي متناسق */}
        <section className="rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-sm">
          {/* صف بيانات الطالب الأساسية (صورة مدمجة وخطوط رشيقة) */}
          <div className="flex items-center gap-3 min-w-0">
            <Avatar photo={student.photo} name={student.name} size={48} frame={student.frame} crown={student.crown} glow={student.glow} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="font-display text-sm sm:text-lg font-extrabold text-ink truncate">
                  {student.name}
                </h2>
                <span className="rounded-full bg-grape-600 px-2 py-0.5 font-display text-[10px] sm:text-xs font-extrabold text-white shadow-2xs shrink-0">
                  المستوى {ar(safeLevel)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-500">
                <span className="rounded-md bg-slate-50 border border-slate-100 px-1.5 py-0.5 truncate">
                  {halaqa?.name || "حلقة التحفيظ"}
                </span>
                <span className="rounded-md bg-emerald-50/80 border border-emerald-100 text-emerald-700 px-1.5 py-0.5 shrink-0 font-mono">
                  #{student.parentAccessToken?.slice(0, 6) || "مفعّل"}
                </span>
              </div>
            </div>
          </div>

          {/* سطر الإحصائيات الثلاثي في سطر واحد بنظام شبكي منظم (grid grid-cols-3 gap-2) وبأحجام متناسقة ودون أي حدود سوداء */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100/80">
            {/* العملات الذهبية */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-2 text-center shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-extrabold text-amber-700">العملات الذهبية</span>
              <span className="flex items-center justify-center gap-1 font-display text-xs sm:text-base font-black text-amber-900 mt-0.5">
                <Coin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {ar(student.coins)}
              </span>
            </div>

            {/* النقاط */}
            <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-2 text-center shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-extrabold text-purple-700">النقاط</span>
              <span className="flex items-center justify-center gap-1 font-display text-xs sm:text-base font-black text-purple-900 mt-0.5">
                <Icon name="bolt" fill className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600" />
                {ar(student.xp)}
              </span>
            </div>

            {/* القلوب */}
            <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-2 text-center shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-extrabold text-rose-700">القلوب</span>
              <div className="mt-0.5 flex justify-center">
                <HeartsRow hearts={student.hearts} max={3} size="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
          </div>

          {/* شريط تقدم المستوى — محمي من الـ NaN */}
          <div className="mt-2.5 pt-2 border-t border-slate-100/60">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">
              <span>تقدم المستوى ({ar(safeLevel)})</span>
              <span className="font-extrabold text-slate-700">{ar(safeInto)} / {ar(safeNeed)} نقطة ({ar(safePct)}%)</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-grape-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${safePct}%` }}
              />
            </div>
          </div>

          {/* ملاحظة الأداء والاتجاه (Trend) — ناعمة وبخلفية هادئة */}
          {trend && (
            <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2 sm:p-2.5 text-[10px] sm:text-[11px] font-bold text-slate-600 flex items-center gap-2">
              <span className="text-sm">
                {trend.tone === "mint" ? "🌟" : trend.tone === "coral" ? "💡" : "✨"}
              </span>
              <div>
                <strong className="text-ink">{trend.label}:</strong> {trend.explanation}
              </div>
            </div>
          )}
        </section>

        {/* 3. تبويبات التنقل الرئيسية — زوايا منحنية ناعمة (rounded-xl) وتبديل سلس */}
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200/60 bg-slate-100/70 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 font-display text-[11px] sm:text-xs font-extrabold transition-all ${
              activeTab === "progress"
                ? "bg-white text-grape-800 shadow-xs font-black"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="chart" className="h-3.5 w-3.5" />
            <span>الحفظ والإنجاز</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 font-display text-[11px] sm:text-xs font-extrabold transition-all ${
              activeTab === "store"
                ? "bg-white text-grape-800 shadow-xs font-black"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="store" className="h-3.5 w-3.5" />
            <span>متجر الطالب</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 font-display text-[11px] sm:text-xs font-extrabold transition-all ${
              activeTab === "purchases"
                ? "bg-white text-grape-800 shadow-xs font-black"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="bag" className="h-3.5 w-3.5" />
            <span>المشتريات ({ar(studentOrders.length)})</span>
          </button>
        </div>

        {/* 4. القسم الأول: الحفظ والإنجاز (شبكة إحصائيات 2x2 مدمجة وسجل الأسبوع) */}
        {activeTab === "progress" && (
          <div className="space-y-3 sm:space-y-3.5">
            {/* بطاقات الإحصاءات الأربعة بنظام كارتين في كل سطر (grid grid-cols-2 gap-2.5) وبلا أي حدود سوداء */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 anim-fade">
              {/* 1. الحضور هذا الأسبوع */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 text-center shadow-2xs hover:shadow-sm transition">
                <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black mb-1">
                  ✓
                </span>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">الحضور هذا الأسبوع</p>
                <p className="mt-0.5 font-display text-base sm:text-lg font-black text-emerald-700">
                  {ar(currPresent)} <span className="text-[10px] sm:text-xs font-bold text-emerald-600">أيام</span>
                </p>
                <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                  {currAbsent > 0 ? `${ar(currAbsent)} غياب` : "بدون أي غياب 👏"}
                </p>
              </div>

              {/* 2. نسبة الانضباط */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 text-center shadow-2xs hover:shadow-sm transition">
                <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-purple-50 text-purple-600 text-xs font-black mb-1">
                  📊
                </span>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">نسبة الانضباط</p>
                <p className="mt-0.5 font-display text-base sm:text-lg font-black text-purple-700">
                  {ar(attendanceRate)}٪
                </p>
                <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                  مجموع الجلسات: {ar(totalDaysEvaluated)}
                </p>
              </div>

              {/* 3. صفحات الحفظ */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 text-center shadow-2xs hover:shadow-sm transition">
                <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-600 text-xs font-black mb-1">
                  📖
                </span>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">صفحات الحفظ</p>
                <p className="mt-0.5 font-display text-base sm:text-lg font-black text-amber-800">
                  {n(memPages)} <span className="text-[10px] sm:text-xs font-bold text-amber-600">صفحة</span>
                </p>
                <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                  {ar(memSessions)} جلسات تسميع
                </p>
              </div>

              {/* 4. صفحات المراجعة */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 text-center shadow-2xs hover:shadow-sm transition">
                <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-600 text-xs font-black mb-1">
                  🔄
                </span>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">صفحات المراجعة</p>
                <p className="mt-0.5 font-display text-base sm:text-lg font-black text-sky-800">
                  {n(revPages)} <span className="text-[10px] sm:text-xs font-bold text-sky-600">صفحة</span>
                </p>
                <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                  {ar(revSessions)} جلسات مراجعة
                </p>
              </div>
            </div>

            {/* الأسبوع الحالي يومًا بيوم */}
            <section className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm space-y-2.5">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink flex items-center gap-1.5">
                  <span>📅</span>
                  <span>سجل الأسبوع الحالي يومًا بيوم</span>
                </h3>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400">الأسبوع {ar(week)}</span>
              </div>

              <div className="space-y-2">
                {DAYS.map((day, idx) => {
                  const state = student.days?.[day.key];
                  const ward = student.ward?.[day.key];
                  const rating = student.recitationRatings?.[day.key];
                  const dateStr = formatHijriDate(addCalendarDays(weekStartDateIso, idx), { day: "numeric", month: "long" });

                  const isAbsent = state?.absent === true;
                  const isPresent = !!state?.a && !isAbsent;
                  const hasMem = isPresent && (!!state?.h || rating?.h === "excellent" || rating?.h === "very-good");
                  const hasRev = isPresent && (!!state?.r || rating?.r === "excellent" || rating?.r === "very-good");

                  return (
                    <div
                      key={day.key}
                      className="rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 hover:bg-slate-50/80 transition"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-xs font-black text-ink">{day.label}</span>
                          <span className="text-[10px] font-bold text-slate-400">&bull; {dateStr}</span>
                        </div>

                        {isAbsent ? (
                          <span className="rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700">
                            غائب
                          </span>
                        ) : isPresent ? (
                          <span className="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800">
                            حاضر ✓
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                            لم يُسجّل بعد
                          </span>
                        )}
                      </div>

                      {isPresent && (
                        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] sm:text-[11px] font-bold">
                          <div className="rounded-lg bg-white p-2 border border-slate-100">
                            <div className="flex items-center justify-between gap-1 text-slate-500 mb-0.5">
                              <span>ورد الحفظ</span>
                              {hasMem && (
                                <span className="rounded bg-emerald-600 px-1 py-0.2 text-[8px] font-black text-white">
                                  {rating?.h === "very-good" ? "جيد جدًا" : "ممتاز"}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-ink truncate">{ward?.memorization?.trim() || "لم يُحدّد"}</p>
                          </div>

                          <div className="rounded-lg bg-white p-2 border border-slate-100">
                            <div className="flex items-center justify-between gap-1 text-slate-500 mb-0.5">
                              <span>ورد المراجعة</span>
                              {hasRev && (
                                <span className="rounded bg-emerald-600 px-1 py-0.2 text-[8px] font-black text-white">
                                  {rating?.r === "very-good" ? "جيد جدًا" : "ممتاز"}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-ink truncate">{ward?.review?.trim() || "لم يُحدّد"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* سجل الأسابيع السابقة */}
            {pastWeeksHistory.length > 0 && (
              <section className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm space-y-2.5">
                <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <span>📚</span>
                  <span>أرشيف الأسابيع السابقة ({ar(pastWeeksHistory.length)} أسابيع)</span>
                </h3>

                <div className="space-y-1.5">
                  {pastWeeksHistory.map((item) => (
                    <div
                      key={item.week}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 hover:bg-slate-50/80 transition"
                    >
                      <div>
                        <h4 className="font-display text-xs font-black text-ink">{item.weekName}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          الحضور: {ar(item.present)} أيام &bull; الغياب: {ar(item.absent)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-black">
                        <span className="rounded-lg border border-amber-100 bg-amber-50/50 px-2 py-0.5 text-amber-900">
                          حفظ: {n(item.memPages)} ص
                        </span>
                        <span className="rounded-lg border border-purple-100 bg-purple-50/50 px-2 py-0.5 text-purple-900">
                          مراجعة: {n(item.revPages)} ص
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 5. القسم الثاني: متجر الطالب — 2-Column Grid على الجوال، صور مدمجة (h-32 إلى h-36) وتنظيم أنيق */}
        {activeTab === "store" && (
          <div className="space-y-3 sm:space-y-3.5">
            {!parentStoreOpen ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 text-center shadow-sm">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 text-2xl mb-2">
                  🔒
                </span>
                <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">متجر الجوائز مغلق حاليًا</h3>
                <p className="mt-1 text-[11px] font-bold text-slate-500 max-w-sm mx-auto leading-relaxed">
                  سيتمكن الطالب من الشراء عند فتح المتجر من قِبل معلم الحلقة.
                </p>
                <div className="mt-3.5 inline-block rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-1 text-xs font-black text-amber-900">
                  رصيد الطالب: {ar(student.coins)} 🪙
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-3.5">
                {/* شريط الرصيد */}
                <div className="rounded-2xl border border-amber-100/80 bg-gradient-to-l from-amber-500/10 via-amber-50/30 to-white p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div>
                    <h3 className="font-display text-xs sm:text-sm font-extrabold text-amber-950">متجر الجوائز والخصائص</h3>
                    <p className="text-[10px] sm:text-[11px] font-bold text-amber-800">يمكنك شراء الجوائز لابنك باستخدام عملاته المكتسبة</p>
                  </div>
                  <div className="rounded-xl bg-white px-2.5 py-1 font-display text-xs sm:text-sm font-black text-amber-950 border border-amber-200/60 shadow-2xs">
                    الرصيد: {ar(student.coins)} 🪙
                  </div>
                </div>

                {/* شبكة المنتجات: عمودين تماماً على الجوال بحجم مربعات متوسطة ومريحة للعين */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-3 md:grid-cols-4">
                  {products.map((p) => {
                    const isCosmetic = p.kind === "cosmetic";
                    const ownedQty = isCosmetic ? (student.inventory.includes(p.id) ? 1 : 0) : bagQty(student, p.id);
                    const owned = ownedQty > 0;
                    const locked = safeLevel < p.minLevel;
                    const poor = student.coins < p.price;
                    const soldOut = owned && (isCosmetic || !p.repeatable);
                    const hasStockLimit = typeof p.stock === "number";
                    const outOfStock = hasStockLimit && (p.stock ?? 0) <= 0;
                    const cantBuy = locked || poor || soldOut || outOfStock;

                    return (
                      <div
                        key={p.id}
                        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-2.5 shadow-sm transition hover:shadow-md ${
                          cantBuy ? "border-slate-100 opacity-75" : "border-slate-100 hover:border-purple-100"
                        }`}
                      >
                        <div>
                          {/* حاوية الصور الموحدة الأبعاد مع h-32 على الجوال وh-36 على الشاشات الأكبر */}
                          <div className="relative h-32 sm:h-36 w-full overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center p-2 border border-slate-100/80 mb-2">
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                className="max-h-full max-w-full object-contain drop-shadow-2xs transition duration-200 group-hover:scale-105"
                              />
                            ) : isCosmetic ? (
                              <div className="h-full w-full flex items-center justify-center">
                                <CosmeticThumb slot={p.slot} value={p.value} />
                              </div>
                            ) : (
                              <div className="grid h-full w-full place-items-center text-slate-300">
                                <Icon name={p.icon || "gift"} className="h-8 w-8" />
                              </div>
                            )}

                            {locked && (
                              <span className="absolute top-1.5 end-1.5 rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur-xs">
                                م{ar(p.minLevel)}
                              </span>
                            )}
                          </div>

                          {/* اسم المنتج وسعره بتنسيق عصري متوازن */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4 className="font-display text-xs sm:text-sm font-extrabold text-ink truncate">{p.name}</h4>
                            <span className="rounded-lg bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black text-amber-900 whitespace-nowrap">
                              {ar(p.price)} 🪙
                            </span>
                          </div>

                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 line-clamp-1 min-h-[16px]">
                            {p.desc}
                          </p>

                          <div className="mt-1 text-[9px] sm:text-[10px] font-extrabold text-slate-400">
                            {hasStockLimit ? (outOfStock ? "نفدت الكمية" : `باقٍ: ${ar(p.stock ?? 0)}`) : "متوفر"}
                          </div>
                        </div>

                        {/* زر الشراء في الأسفل */}
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={cantBuy}
                            onClick={() => addToCart(p)}
                            className="w-full rounded-xl bg-grape-600 py-1.5 text-[11px] sm:text-xs font-black text-white hover:bg-grape-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none shadow-2xs"
                          >
                            {locked ? `مغلق (م${ar(p.minLevel)})` : soldOut ? "تم الشراء" : outOfStock ? "نفدت الكمية" : poor ? "الرصيد لا يكفي" : "+ أضف للسلة"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* شريط السلة العائم */}
                {cart.length > 0 && (
                  <div className="fixed bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 max-w-2xl mx-auto z-40 rounded-2xl border border-purple-100 bg-white/95 backdrop-blur-md p-3 shadow-xl anim-slide-up">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xs sm:text-sm font-extrabold text-ink">سلة المشتريات ({ar(cart.length)})</span>
                          <span className="font-display text-xs font-black text-amber-950 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            الإجمالي: {ar(cartTotal)} 🪙
                          </span>
                        </div>
                        {/* كل منتج زر مستقل */}
                        <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto">
                          {cart.map((c) => {
                            const p = products.find((x) => x.id === c.itemId);
                            if (!p) return null;
                            return (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/70 px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-slate-700 shadow-2xs"
                              >
                                <span>{p.name} {c.qty > 1 ? `(${ar(c.qty)})` : ""}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(c.id)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full h-4 w-4 grid place-items-center text-xs font-black ms-0.5 transition"
                                  title="حذف هذا المنتج فقط من السلة"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isSubmitting || student.coins < cartTotal}
                          onClick={handleCheckout}
                          className="rounded-xl bg-amber-500 px-3.5 sm:px-4 py-2 font-display text-xs sm:text-sm font-black text-ink shadow-xs hover:bg-amber-600 transition active:translate-y-0.5 disabled:opacity-40"
                        >
                          {isSubmitting ? "جاري الشراء..." : "إتمام الشراء ✓"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. القسم الثالث: سجل المشتريات */}
        {activeTab === "purchases" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink">
                سجل المشتريات والجوائز ({ar(studentOrders.length)})
              </h3>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                تسليم يدوي موثق من معلم الحلقة
              </span>
            </div>

            {studentOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 sm:p-8 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-xl mb-2">
                  🛍️
                </span>
                <p className="font-display text-xs sm:text-sm font-extrabold text-ink">لا توجد مشتريات مسجلة بعد</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                  عند شراء منتج أو جائزة من المتجر، ستظهر تفاصيلها وحالة تسليمها هنا فورًا.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:gap-2.5">
                {studentOrders.map((order) => {
                  const isDone = order.status === "delivered";
                  const pDate = new Date(order.purchasedAt);

                  return (
                    <div
                      key={order.id}
                      className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 shadow-2xs transition ${
                        isDone ? "border-emerald-100 bg-emerald-50/20" : "border-slate-100 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 overflow-hidden rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-1">
                          {order.itemImage ? (
                            <img src={order.itemImage} alt={order.itemName} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Icon name={order.itemIcon || "gift"} className="h-4 w-4 text-grape-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-display text-xs font-extrabold text-ink truncate">
                            {order.itemName}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-500">
                            الكمية: {ar(order.qty ?? 1)} &bull; {ar(order.price)} 🪙
                          </p>
                          <p className="text-[9px] font-mono text-slate-400">
                            #{order.id.slice(0, 8)} &bull; {pDate.toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <span className="rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                            تم التسليم بنجاح ✓
                          </span>
                        ) : (
                          <span className="rounded-lg bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            بانتظار التسليم ⏳
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <footer className="text-center pt-6 text-[11px] font-bold text-slate-400">
          منصة نور الحفّاظ &bull; متابعة حصرية للطالب {student.name}
        </footer>
      </main>
    </div>
  );
}
