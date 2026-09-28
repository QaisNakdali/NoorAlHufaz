/* بوابة خاصة بأولياء الأمور — متابعة حصرية لمستوى الطالب ومتجر متكامل للشراء بالعملات */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../appState";
import { analyzeStudentTrend, pagesForWardDay } from "../analytics";
import { ar, bagQty, DAYS, levelInfo, type ShopItem, type Student } from "../core";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { Icon } from "./ui";
import { formatHijriDate, addCalendarDays } from "../hijriDate";
import { roundUpToQuarter } from "../statisticsNumber";

const n = (value: number) => ar(roundUpToQuarter(value));

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
  const [cart, setCart] = useState<{ itemId: string; qty: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // البحث الدائم عن الطالب المطابق لرمز الوصول المشفر
  const student = useMemo(() => {
    if (!token || !token.trim()) return null;
    return students.find((s) => s.parentAccessToken === token.trim()) || null;
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="max-w-md w-full rounded-3xl border-2 border-grape-200 bg-white p-6 sm:p-8 shadow-xl">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral-100 text-coral-600 mb-4">
            <Icon name="alert" className="h-8 w-8" strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-xl font-black text-ink">
            هذا الرابط لم يعد متاحًا
          </h2>
          <p className="mt-3 text-sm font-bold text-grape-600 leading-relaxed">
            يرجى التواصل مع إدارة الحلقة أو معلم الطالب للحصول على رابط المتابعة الصحيح والخاص بالطالب.
          </p>
          <div className="mt-6 pt-4 border-t border-grape-100 text-xs font-bold text-grape-400">
            نور الحفّاظ &bull; منصة التحفيظ والمتابعة القرآنية
          </div>
        </div>
      </div>
    );
  }

  const { level } = levelInfo(student.xp);

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
    .filter((w): w is NonNullable<typeof w> => !!w)
    .sort((a, b) => b.week - a.week);

  // طلبات الشراء الخاصة بهذا الطالب
  const studentOrders = useMemo(() => {
    return orders.filter((o) => o.studentId === student.id);
  }, [orders, student.id]);

  // إدارة السلة
  const addToCart = (product: ShopItem) => {
    if (student.coins < product.price) {
      toast("error", "لا توجد عملات كافية لشراء هذا المنتج");
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.itemId === product.id);
      if (idx >= 0) {
        if (!product.repeatable && product.kind !== "cosmetic") {
          toast("error", "هذا المنتج لا يمكن شراؤه أكثر من مرة");
          return prev;
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        toast("success", `تمت إضافة نسخة أخرى من «${product.name}» للسلة`);
        return updated;
      }
      toast("success", `تمت إضافة «${product.name}» إلى السلة`);
      return [...prev, { itemId: product.id, qty: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => {
      const p = products.find((x) => x.id === c.itemId);
      return sum + (p ? p.price * c.qty : 0);
    }, 0);
  }, [cart, products]);

  const handleCheckout = () => {
    if (isSubmitting) return;
    if (cart.length === 0) return;
    if (student.coins < cartTotal) {
      toast("error", "رصيد عملات الطالب لا يكفي لإتمام الشراء");
      return;
    }

    setIsSubmitting(true);
    const res = checkoutParentCart(student.id, cart);
    setIsSubmitting(false);

    if (res.success) {
      setCart([]);
      setActiveTab("purchases");
    } else {
      toast("error", res.error || "تعذر إتمام العملية");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-ink pb-20" dir="rtl">
      {/* شريط علوي أنيق */}
      <header className="sticky top-0 z-20 border-b border-grape-200/80 bg-white/95 backdrop-blur-md px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-grape-600 text-white font-black text-sm">
              📖
            </span>
            <div>
              <h1 className="font-display text-base font-extrabold text-ink leading-tight">
                بوابة متابعة الطالب
              </h1>
              <p className="text-[11px] font-bold text-grape-500">نور الحفّاظ &bull; متابعة حصرية لولي الأمر</p>
            </div>
          </div>
          <span className="rounded-full bg-grape-100 px-3 py-1 text-xs font-black text-grape-700">
            الأسبوع {ar(week)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {/* بطاقة معلومات الطالب الأساسية */}
        <section className="rounded-3xl border-2 border-grape-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar photo={student.photo} name={student.name} size={64} frame={student.frame} crown={student.crown} glow={student.glow} />
              <div className="min-w-0">
                <h2 className="font-display text-xl font-black text-ink truncate">
                  {student.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-grape-100 px-2.5 py-0.5 text-xs font-black text-grape-700">
                    {halaqa?.name || "حلقة التحفيظ"}
                  </span>
                  <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-black text-gold-800">
                    المستوى {ar(level)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 ms-auto sm:ms-0">
              <div className="rounded-2xl border border-gold-200 bg-gold-50/70 px-3.5 py-2 text-center">
                <span className="block text-[10px] font-bold text-gold-700">العملات الذهبية</span>
                <span className="font-display text-lg font-black text-gold-900">{ar(student.coins)} 🪙</span>
              </div>
              <div className="rounded-2xl border border-grape-100 bg-grape-50/60 px-3 py-2 text-center">
                <span className="block text-[10px] font-bold text-grape-400">النقاط</span>
                <span className="font-display text-base font-black text-grape-700">{ar(student.xp)}</span>
              </div>
              <div className="rounded-2xl border border-coral-100 bg-coral-50/60 px-3 py-2 text-center">
                <span className="block text-[10px] font-bold text-coral-400">القلوب</span>
                <span className="font-display text-base font-black text-coral-600">{ar(student.hearts)}/3</span>
              </div>
            </div>
          </div>

          {trend && (
            <div className={`mt-4 rounded-2xl p-3 border text-xs font-bold flex items-center gap-2 ${
              trend.tone === "mint"
                ? "bg-mint-50/60 border-mint-200 text-mint-800"
                : trend.tone === "coral"
                ? "bg-coral-50/60 border-coral-200 text-coral-800"
                : "bg-grape-50/60 border-grape-200 text-grape-700"
            }`}>
              <span className="text-base">
                {trend.tone === "mint" ? "🌟" : trend.tone === "coral" ? "💡" : "✨"}
              </span>
              <div>
                <strong className="block font-black">{trend.label}:</strong>
                <span className="opacity-90">{trend.explanation}</span>
              </div>
            </div>
          )}
        </section>

        {/* أزرار التنقل بين أقسام البوابة */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-grape-200 bg-white p-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-xs font-black transition ${
              activeTab === "progress"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-600 hover:bg-grape-50"
            }`}
          >
            <Icon name="chart" className="h-4 w-4" />
            <span>الحفظ والإنجاز</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-xs font-black transition ${
              activeTab === "store"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-600 hover:bg-grape-50"
            }`}
          >
            <Icon name="store" className="h-4 w-4" />
            <span>متجر الطالب</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-xs font-black transition ${
              activeTab === "purchases"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-600 hover:bg-grape-50"
            }`}
          >
            <Icon name="bag" className="h-4 w-4" />
            <span>المشتريات ({ar(studentOrders.length)})</span>
          </button>
        </div>

        {/* القسم الأول: الحفظ والإنجاز */}
        {activeTab === "progress" && (
          <div className="space-y-4">
            {/* بطاقات الإحصاءات */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-mint-200 bg-white p-4 text-center">
                <span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-mint-50 text-mint-700 text-sm font-black mb-1">
                  ✓
                </span>
                <p className="text-xs font-black text-grape-500">الحضور هذا الأسبوع</p>
                <p className="mt-1 font-display text-xl font-black text-mint-700">
                  {ar(currPresent)} <span className="text-xs font-bold text-mint-600">أيام</span>
                </p>
                <p className="text-[11px] font-bold text-grape-400 mt-0.5">
                  {currAbsent > 0 ? `${ar(currAbsent)} غياب` : "بدون أي غياب 👏"}
                </p>
              </div>

              <div className="rounded-2xl border-2 border-grape-200 bg-white p-4 text-center">
                <span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-grape-50 text-grape-700 text-sm font-black mb-1">
                  📊
                </span>
                <p className="text-xs font-black text-grape-500">نسبة الانضباط</p>
                <p className="mt-1 font-display text-xl font-black text-grape-700">
                  {ar(attendanceRate)}٪
                </p>
                <p className="text-[11px] font-bold text-grape-400 mt-0.5">
                  مجموع الجلسات: {ar(totalDaysEvaluated)}
                </p>
              </div>

              <div className="rounded-2xl border-2 border-gold-200 bg-white p-4 text-center">
                <span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-gold-50 text-gold-700 text-sm font-black mb-1">
                  📖
                </span>
                <p className="text-xs font-black text-grape-500">صفحات الحفظ</p>
                <p className="mt-1 font-display text-xl font-black text-gold-700">
                  {n(memPages)} <span className="text-xs font-bold text-gold-600">صفحة</span>
                </p>
                <p className="text-[11px] font-bold text-grape-400 mt-0.5">
                  {ar(memSessions)} جلسات تسميع
                </p>
              </div>

              <div className="rounded-2xl border-2 border-grape-200 bg-white p-4 text-center">
                <span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-grape-50 text-grape-700 text-sm font-black mb-1">
                  🔄
                </span>
                <p className="text-xs font-black text-grape-500">صفحات المراجعة</p>
                <p className="mt-1 font-display text-xl font-black text-grape-700">
                  {n(revPages)} <span className="text-xs font-bold text-grape-600">صفحة</span>
                </p>
                <p className="text-[11px] font-bold text-grape-400 mt-0.5">
                  {ar(revSessions)} جلسات مراجعة
                </p>
              </div>
            </div>

            {/* الأسبوع الحالي يومًا بيوم */}
            <section className="rounded-3xl border-2 border-grape-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
              <div className="border-b border-grape-100 pb-2.5 flex items-center justify-between">
                <h3 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
                  <span>📅</span>
                  <span>سجل الأسبوع الحالي يومًا بيوم</span>
                </h3>
                <span className="text-xs font-bold text-grape-500">الأسبوع {ar(week)}</span>
              </div>

              <div className="space-y-2.5">
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
                      className="rounded-2xl border border-grape-100 bg-grape-50/20 p-3 hover:bg-grape-50/50 transition"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-grape-100/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black text-ink">{day.label}</span>
                          <span className="text-[11px] font-bold text-grape-400">&bull; {dateStr}</span>
                        </div>

                        {isAbsent ? (
                          <span className="rounded-full bg-coral-100 px-2.5 py-0.5 text-[11px] font-black text-coral-700">
                            غائب
                          </span>
                        ) : isPresent ? (
                          <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-[11px] font-black text-mint-800">
                            حاضر
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                            لم تُعقد
                          </span>
                        )}
                      </div>

                      {isPresent && (
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2 text-xs">
                          <div className="rounded-xl border border-gold-200/60 bg-gold-50/20 p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-black text-gold-800 flex items-center gap-1">
                                <Icon name="book" className="h-3 w-3" />
                                <span>الحفظ:</span>
                              </span>
                              {hasMem ? (
                                <span className="rounded bg-mint-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                                  {rating?.h === "very-good" ? "جيد جدًا" : "ممتاز ✓"}
                                </span>
                              ) : (
                                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-black text-amber-800">
                                  لم يُسمّع
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 truncate font-bold">
                              {ward?.memorization?.trim() || "لم يُسجل ورد محدد"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-grape-200/60 bg-grape-50/20 p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-black text-grape-800 flex items-center gap-1">
                                <Icon name="refresh" className="h-3 w-3" />
                                <span>المراجعة:</span>
                              </span>
                              {hasRev ? (
                                <span className="rounded bg-mint-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                                  {rating?.r === "very-good" ? "جيد جدًا" : "ممتاز ✓"}
                                </span>
                              ) : (
                                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-black text-amber-800">
                                  لم يُسمّع
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 truncate font-bold">
                              {ward?.review?.trim() || "لم يُسجل ورد محدد"}
                            </p>
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
              <section className="rounded-3xl border-2 border-grape-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
                <h3 className="font-display text-base font-extrabold text-ink flex items-center gap-2 border-b border-grape-100 pb-2.5">
                  <span>📚</span>
                  <span>أرشيف الأسابيع السابقة ({ar(pastWeeksHistory.length)} أسابيع)</span>
                </h3>

                <div className="space-y-2">
                  {pastWeeksHistory.map((item) => (
                    <div
                      key={item.week}
                      className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-grape-100 bg-grape-50/20 p-3 hover:bg-grape-50/40 transition"
                    >
                      <div>
                        <h4 className="font-display text-sm font-black text-ink">{item.weekName}</h4>
                        <p className="text-[11px] font-bold text-grape-400 mt-0.5">
                          الحضور: {ar(item.present)} أيام &bull; الغياب: {ar(item.absent)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-xl border border-gold-200 bg-gold-50/50 px-2.5 py-1 text-xs font-black text-gold-800">
                          حفظ: {n(item.memPages)} ص
                        </span>
                        <span className="rounded-xl border border-grape-200 bg-grape-50 px-2.5 py-1 text-xs font-black text-grape-700">
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

        {/* القسم الثاني: متجر الطالب */}
        {activeTab === "store" && (
          <div className="space-y-4">
            {!parentStoreOpen ? (
              <div className="rounded-3xl border-2 border-grape-200 bg-white p-8 text-center shadow-sm">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700 text-3xl mb-3">
                  🔒
                </span>
                <h3 className="font-display text-lg font-black text-ink">المتجر مغلق حاليًا</h3>
                <p className="mt-2 text-sm font-bold text-grape-600 leading-relaxed max-w-md mx-auto">
                  سيتمكن الطالب من الشراء عند إعادة فتح المتجر من قِبل إدارة الحلقة.
                </p>
                <div className="mt-4 inline-block rounded-xl border border-gold-200 bg-gold-50 px-4 py-2 text-xs font-black text-gold-800">
                  رصيد الطالب الحالي: {ar(student.coins)} عملة ذهبية
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-gold-200 bg-gold-50/60 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div>
                    <h3 className="font-display text-sm font-black text-gold-900">متجر الجوائز والخصائص</h3>
                    <p className="text-xs font-bold text-gold-800/80">يمكنك شراء الجوائز لابنك باستخدام عملاته المكتسبة</p>
                  </div>
                  <div className="rounded-xl bg-white px-3.5 py-1.5 font-display text-sm font-black text-gold-900 border border-gold-200 shadow-2xs">
                    الرصيد: {ar(student.coins)} 🪙
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((p) => {
                    const isCosmetic = p.kind === "cosmetic";
                    const ownedQty = isCosmetic ? (student.inventory.includes(p.id) ? 1 : 0) : bagQty(student, p.id);
                    const owned = ownedQty > 0;
                    const locked = level < p.minLevel;
                    const poor = student.coins < p.price;
                    const soldOut = owned && (isCosmetic || !p.repeatable);
                    const hasStockLimit = typeof p.stock === "number";
                    const outOfStock = hasStockLimit && (p.stock ?? 0) <= 0;
                    const cantBuy = locked || poor || soldOut || outOfStock;

                    return (
                      <div
                        key={p.id}
                        className={`flex flex-col justify-between rounded-2xl border-2 bg-white p-3.5 shadow-xs transition ${
                          cantBuy ? "border-grape-100 opacity-75" : "border-grape-200 hover:border-grape-300"
                        }`}
                      >
                        <div>
                          <div className="h-28 overflow-hidden rounded-xl bg-grape-50/50 mb-2.5">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            ) : isCosmetic ? (
                              <CosmeticThumb slot={p.slot} value={p.value} />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-grape-400">
                                <Icon name={p.icon} className="h-10 w-10" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display text-sm font-black text-ink truncate">{p.name}</span>
                            <span className="font-display text-xs font-black text-gold-800 shrink-0 bg-gold-50 px-2 py-0.5 rounded-lg border border-gold-100">
                              {ar(p.price)} 🪙
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] font-bold text-grape-500 line-clamp-2">{p.desc}</p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-grape-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-grape-400">
                            {locked ? `يتطلب المستوى ${ar(p.minLevel)}` : hasStockLimit ? `المتبقي: ${ar(p.stock ?? 0)}` : "متاح"}
                          </span>

                          <button
                            type="button"
                            disabled={cantBuy}
                            onClick={() => addToCart(p)}
                            className="rounded-xl bg-grape-600 px-3 py-1.5 text-xs font-black text-white hover:bg-grape-700 transition disabled:opacity-40 disabled:pointer-events-none"
                          >
                            {locked ? "مغلق" : soldOut ? "تم الشراء" : outOfStock ? "نفدت الكمية" : poor ? "الرصيد لا يكفي" : "+ أضف للسلة"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* شريط السلة العائم */}
                {cart.length > 0 && (
                  <div className="fixed bottom-3 inset-x-4 max-w-2xl mx-auto z-30 rounded-2xl border-2 border-grape-300 bg-white p-4 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black text-ink">سلة المشتريات ({ar(cart.length)} عناصر)</span>
                          <span className="font-display text-xs font-black text-gold-800 bg-gold-50 px-2 py-0.5 rounded-lg border border-gold-200">
                            الإجمالي: {ar(cartTotal)} 🪙
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {cart.map((c) => {
                            const p = products.find((x) => x.id === c.itemId);
                            if (!p) return null;
                            return (
                              <span
                                key={c.itemId}
                                className="inline-flex items-center gap-1 rounded-lg bg-grape-50 border border-grape-200 px-2 py-0.5 text-[10px] font-bold text-grape-700"
                              >
                                <span>{p.name} {c.qty > 1 ? `(${ar(c.qty)})` : ""}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(c.itemId)}
                                  className="text-coral-500 hover:text-coral-700 font-black ms-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ms-auto sm:ms-0">
                        <button
                          type="button"
                          disabled={isSubmitting || student.coins < cartTotal}
                          onClick={handleCheckout}
                          className="rounded-xl bg-gold-500 px-4 py-2 text-xs font-black text-ink shadow-sm hover:bg-gold-600 transition disabled:opacity-40"
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

        {/* القسم الثالث: مشتريات الطالب السابقة */}
        {activeTab === "purchases" && (
          <div className="space-y-3">
            {studentOrders.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white/70 p-12 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl mb-2">
                  🛍️
                </span>
                <p className="font-display text-base font-extrabold text-ink">لا توجد مشتريات مسجلة بعد</p>
                <p className="mt-1 text-xs font-bold text-grape-500">
                  عند شراء منتج أو جائزة من المتجر، ستظهر تفاصيلها وحالة تسليمها هنا فورًا.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {studentOrders.map((order) => {
                  const isDone = order.status === "delivered";
                  const pDate = new Date(order.purchasedAt);

                  return (
                    <div
                      key={order.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-3.5 shadow-xs transition ${
                        isDone ? "border-mint-200 bg-mint-50/20" : "border-gold-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-grape-50 border border-grape-100">
                          {order.itemImage ? (
                            <img src={order.itemImage} alt={order.itemName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-grape-400">
                              <Icon name={order.itemIcon || "gift"} className="h-5 w-5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-display text-sm font-black text-ink">{order.itemName}</h4>
                          <p className="mt-0.5 text-xs font-bold text-grape-500">
                            السعر: {ar(order.price)} عملة &bull; التاريخ: {pDate.toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>

                      <div className="ms-auto sm:ms-0">
                        {isDone ? (
                          <span className="rounded-xl bg-mint-100 px-3 py-1 text-xs font-black text-mint-800">
                            تم التسليم بنجاح ✓
                          </span>
                        ) : (
                          <span className="rounded-xl bg-gold-100 px-3 py-1 text-xs font-black text-gold-800">
                            بانتظار التسليم من المعلم ⏳
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

        <footer className="text-center pt-6 text-xs font-bold text-grape-400">
          منصة نور الحفّاظ &bull; متابعة حصرية للطالب {student.name}
        </footer>
      </main>
    </div>
  );
}
