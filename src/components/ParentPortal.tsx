/* بوابة خاصة بأولياء الأمور — متابعة عصرية راقية، إحصائيات بيانية واضحة، ومتجر هدايا متناسق */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../appState";
import { generateParentAIGuidance, pagesForWardDay } from "../analytics";
import { ar, bagQty, DAYS, levelInfo, type ShopItem, type Student, uid } from "../core";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { Coin, HeartsRow, Icon } from "./ui";
import { formatHijriDate, addCalendarDays, formatTeachingWeekRange, localDateKey, dateFromLocalKey, hijriMonthKey, teachingWeekStart } from "../hijriDate";
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
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // العثور على الطالب بناءً على رمز الوصول الفريد
  const student = useMemo(() => {
    if (!token || !token.trim()) return null;
    return students.find((s) => s.parentAccessToken === token.trim()) || null;
  }, [students, token]);

  // إدارة سلة المشتريات وحفظها في localStorage لكل طالب
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!student) return [];
    try {
      const saved = localStorage.getItem(`noor_cart_${student.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    if (student) {
      try {
        localStorage.setItem(`noor_cart_${student.id}`, JSON.stringify(cart));
      } catch {}
    }
  }, [cart, student]);

  const halaqa = useMemo(() => {
    if (!student?.halaqaId) return null;
    return halaqas.find((h) => h.id === student.halaqaId) || null;
  }, [student, halaqas]);

  // توليد التوجيهات التربوية الذكية بناءً على تاريخ الطالب التراكمي
  const guidance = useMemo(() => {
    if (!student) return null;
    return generateParentAIGuidance(student, weeksLog, parentContacts);
  }, [student, weeksLog, parentContacts]);

  useEffect(() => {
    if (student) {
      logParentAccess(student.id, activeTab === "store");
    }
  }, [student, activeTab, logParentAccess]);

  if (!student) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="max-w-md w-full rounded-3xl border border-grape-200 bg-white p-6 sm:p-8 shadow-xl">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral-50 text-coral-600 mb-4">
            <Icon name="alert" className="h-8 w-8" strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-xl font-extrabold text-ink">
            رابط المتابعة غير متاح
          </h2>
          <p className="mt-3 text-sm font-bold text-grape-600 leading-relaxed">
            يرجى التأكد من الرابط أو التواصل مع إدارة الحلقة للحصول على الرابط المحدث لولي الأمر.
          </p>
          <div className="mt-6 pt-4 border-t border-grape-100 text-xs font-bold text-grape-400">
            منصة نور الحفّاظ &bull; متابعة القرآن الكريم
          </div>
        </div>
      </div>
    );
  }

  const { level, nextLevelAt, currentLevelAt } = levelInfo(student.xp);
  const xpIntoLevel = Math.max(0, student.xp - currentLevelAt);
  const xpNeeded = Math.max(1, nextLevelAt - currentLevelAt);
  const levelProgressPct = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));

  // حساب يوم اليوم الفعلي في الأسبوع التعليمي (الأحد - الأربعاء)
  const today = new Date();
  const todayIso = localDateKey(today);
  const currentWeekStart = dateFromLocalKey(weekStartDateIso) ?? teachingWeekStart();
  const dayOffset = Math.floor((today.getTime() - currentWeekStart.getTime()) / (24 * 3600 * 1000));
  const activeDayIndex = Math.max(0, Math.min(3, dayOffset >= 0 && dayOffset <= 3 ? dayOffset : 0));
  const todayDayKey = DAYS[activeDayIndex].key;

  const todayState = student.days?.[todayDayKey];
  const todayWard = student.ward?.[todayDayKey];
  const todayRating = student.recitationRatings?.[todayDayKey];
  const todayDateStr = formatHijriDate(addCalendarDays(weekStartDateIso || localDateKey(teachingWeekStart()), activeDayIndex), { weekday: "long", day: "numeric", month: "long" });

  const isTodayAbsent = todayState?.absent === true || student.dailyAbsentDate === todayIso;
  const isTodayPresent = (todayState?.a === true || student.dailyRecitedDate === todayIso) && !isTodayAbsent;
  const hasTodayMem = isTodayPresent && (todayState?.h || todayRating?.h === "excellent" || todayRating?.h === "very-good");
  const hasTodayRev = isTodayPresent && (todayState?.r || todayRating?.r === "excellent" || todayRating?.r === "very-good");

  const todayMemPages = hasTodayMem ? pagesForWardDay(student, todayDayKey, "memorization").pages : 0;
  const todayRevPages = hasTodayRev ? pagesForWardDay(student, todayDayKey, "review").pages : 0;

  // إحصائيات الأسبوع الحالي
  const currPresent = DAYS.filter((d) => !!student.days?.[d.key]?.a && !student.days?.[d.key]?.absent).length;
  const currAbsent = DAYS.filter((d) => student.days?.[d.key]?.absent === true).length;
  
  let currWeekMemPages = 0;
  let currWeekRevPages = 0;
  let currWeekExcellentCount = 0;
  let currWeekVeryGoodCount = 0;

  for (const d of DAYS) {
    const st = student.days?.[d.key];
    const rt = student.recitationRatings?.[d.key];
    if (st?.a && !st.absent) {
      if (st.h || rt?.h === "excellent" || rt?.h === "very-good") {
        currWeekMemPages += pagesForWardDay(student, d.key, "memorization").pages;
        if (rt?.h === "excellent") currWeekExcellentCount++;
        if (rt?.h === "very-good") currWeekVeryGoodCount++;
      }
      if (st.r || rt?.r === "excellent" || rt?.r === "very-good") {
        currWeekRevPages += pagesForWardDay(student, d.key, "review").pages;
        if (rt?.r === "excellent") currWeekExcellentCount++;
        if (rt?.r === "very-good") currVeryGoodCount++;
      }
    }
  }

  // إحصائيات الشهر الحالي
  const currentMonthKey = hijriMonthKey(today);
  const currentMonthName = new Intl.DateTimeFormat("ar", { month: "long" }).format(today);

  const monthLogs = weeksLog.filter((log) => {
    const d = log.weekStartDateIso ? dateFromLocalKey(log.weekStartDateIso) : log.savedAtIso ? new Date(log.savedAtIso) : null;
    return d && hijriMonthKey(d) === currentMonthKey;
  });

  let monthPresent = currPresent;
  let monthAbsent = currAbsent;
  let monthMemPages = currWeekMemPages;
  let monthRevPages = currWeekRevPages;
  let monthExcCount = currWeekExcellentCount;
  let monthVgCount = currWeekVeryGoodCount;

  for (const log of monthLogs) {
    if (log.week === week) continue;
    const rec = log.records?.find((r) => r.id === student.id);
    if (rec) {
      monthPresent += DAYS.filter((d) => !!rec.days?.[d.key]?.a && !rec.days?.[d.key]?.absent).length;
      monthAbsent += DAYS.filter((d) => rec.days?.[d.key]?.absent === true).length;
      for (const d of DAYS) {
        const st = rec.days?.[d.key];
        const rt = rec.recitationRatings?.[d.key];
        if (st?.a && !st.absent) {
          if (st.h || rt?.h === "excellent" || rt?.h === "very-good") {
            monthMemPages += pagesForWardDay(rec as unknown as Student, d.key, "memorization").pages;
            if (rt?.h === "excellent") monthExcCount++;
            if (rt?.h === "very-good") monthVgCount++;
          }
          if (st.r || rt?.r === "excellent" || rt?.r === "very-good") {
            monthRevPages += pagesForWardDay(rec as unknown as Student, d.key, "review").pages;
            if (rt?.r === "excellent") monthExcCount++;
            if (rt?.r === "very-good") monthVgCount++;
          }
        }
      }
    }
  }

  // طلبات الشراء للطالب
  const studentOrders = useMemo(() => {
    return orders.filter((o) => o.studentId === student.id);
  }, [orders, student.id]);

  // إضافة منتج للسلة
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
        toast("success", `تمت زيادة كمية «${product.name}» في السلة`);
        return prev.map((c) => (c.itemId === product.id ? { ...c, qty: c.qty + 1 } : c));
      }
      toast("success", `أُضيف «${product.name}» إلى السلة`);
      return [...prev, { id: uid(), itemId: product.id, qty: 1 }];
    });
  };

  // حذف عنصر محدد فقط عبر ID المستقل
  const removeFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((c) => c.id !== cartId));
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
      toast("error", res.error || "تعذر إتمام عملية الشراء");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-ink pb-24" dir="rtl">
      {/* 1. الشريط العلوي — أنيق وفخم */}
      <header className="sticky top-0 z-30 border-b border-grape-100 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_4px_20px_-10px_rgba(76,29,149,0.08)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-grape-700 via-grape-600 to-indigo-500 text-white shadow-md shadow-grape-600/25">
              <Icon name="book" className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-base sm:text-lg font-extrabold text-ink leading-tight">
                نور الحفّاظ <span className="text-xs font-bold text-grape-600 font-sans">| بوابة ولي الأمر</span>
              </h1>
              <p className="text-[11px] font-bold text-grape-500">متابعة الإنجاز والتحفيز المستمر</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-grape-50 border border-grape-200/80 px-3 py-1 text-xs font-extrabold text-grape-700">
              {formatTeachingWeekRange(weekStartDateIso || localDateKey(teachingWeekStart()))}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-5 space-y-5">
        {/* 2. بطاقة الطالب الرئيسية (Hero Profile Card) */}
        <section className="relative overflow-hidden rounded-[26px] border border-grape-200/90 bg-white p-5 sm:p-6 shadow-[0_4px_24px_-6px_rgba(76,29,149,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar photo={student.photo} name={student.name} size={64} frame={student.frame} crown={student.crown} glow={student.glow} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">
                    {student.name}
                  </h2>
                  <span className="rounded-full bg-gradient-to-r from-grape-600 to-indigo-600 px-3 py-0.5 font-display text-xs font-extrabold text-white shadow-xs">
                    المستوى {ar(level)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-grape-600">
                  <span className="rounded-lg bg-grape-50/80 border border-grape-200/60 px-2.5 py-0.5">
                    {halaqa?.name || "حلقة القرآن الكريم"}
                  </span>
                  <span className="rounded-lg bg-mint-50/80 border border-mint-200 text-mint-700 px-2.5 py-0.5">
                    كود المتابعة: #{student.parentAccessToken?.slice(0, 6) || "مفعّل"}
                  </span>
                </div>
              </div>
            </div>

            {/* الأرصدة والقلوب في كبسولات فخمة */}
            <div className="flex flex-wrap items-center gap-2.5 ms-auto sm:ms-0">
              <div className="rounded-2xl border border-gold-300 bg-gradient-to-b from-amber-50 to-gold-50/40 px-3.5 py-2 text-center min-w-[78px] shadow-2xs">
                <span className="block text-[10px] font-extrabold text-gold-700">العملات الذهبية</span>
                <span className="flex items-center justify-center gap-1 font-display text-base sm:text-lg font-black text-gold-900 mt-0.5">
                  <Coin className="h-4 w-4" />
                  {ar(student.coins)}
                </span>
              </div>

              <div className="rounded-2xl border border-grape-200 bg-gradient-to-b from-white to-grape-50/50 px-3.5 py-2 text-center min-w-[78px] shadow-2xs">
                <span className="block text-[10px] font-extrabold text-grape-500">إجمالي النقاط</span>
                <span className="flex items-center justify-center gap-1 font-display text-base sm:text-lg font-black text-grape-800 mt-0.5">
                  <Icon name="bolt" fill className="h-4 w-4 text-grape-600" />
                  {ar(student.xp)}
                </span>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-gradient-to-b from-white to-rose-50/50 px-3.5 py-2 text-center min-w-[78px] shadow-2xs">
                <span className="block text-[10px] font-extrabold text-rose-600">القلوب</span>
                <div className="mt-1 flex justify-center">
                  <HeartsRow hearts={student.hearts} max={3} size="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* شريط تقدم المستوى */}
          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-grape-600 mb-1.5">
              <span>تقدم المستوى الحالي ({ar(level)})</span>
              <span className="font-extrabold">{ar(xpIntoLevel)} / {ar(xpNeeded)} نقطة ({ar(levelProgressPct)}%)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-grape-600 to-indigo-500 transition-all duration-700"
                style={{ width: `${levelProgressPct}%` }}
              />
            </div>
          </div>
        </section>

        {/* 3. تنبيه الاختبار القادم (إذا كان مجدولاً للطالب فقط) */}
        {student.isTesting && (
          <section className="relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-l from-amber-500/10 via-amber-100/20 to-white p-4 sm:p-5 shadow-[0_0_20px_rgba(245,158,11,0.14)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white font-black text-lg shadow-sm">
                  📝
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-xs font-black">
                      اختبار قادم
                    </span>
                    <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">
                      الطالب مرشح لاختبار مرحلي في الحلقة
                    </h3>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-600 leading-relaxed">
                    يُرجى تشجيع الطالب على مراجعة السور المقررة والتسميع المسبق في المنزل لضمان الجاهزية والتميز.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. تبويبات التنقل الرئيسية */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-grape-200/80 bg-white p-1.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-xs sm:text-sm font-extrabold transition-all ${
              activeTab === "progress"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-600 hover:bg-grape-50"
            }`}
          >
            <Icon name="chart" className="h-4 w-4" />
            <span>لوحة المتابعة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-xs sm:text-sm font-extrabold transition-all ${
              activeTab === "store"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-600 hover:bg-grape-50"
            }`}
          >
            <Icon name="store" className="h-4 w-4" />
            <span>متجر الجوائز</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-xs sm:text-sm font-extrabold transition-all ${
              activeTab === "purchases"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-600 hover:bg-grape-50"
            }`}
          >
            <Icon name="gift" className="h-4 w-4" />
            <span>المشتريات ({ar(studentOrders.length)})</span>
          </button>
        </div>

        {/* 5. التبويب الأول: لوحة المتابعة اليومية والإحصائيات البيانية */}
        {activeTab === "progress" && (
          <div className="space-y-5">
            {/* أ) أداء اليوم */}
            <section className="rounded-[24px] border border-grape-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700 text-base">
                    📊
                  </span>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-ink">
                      أداء اليوم · {todayDateStr}
                    </h3>
                    <p className="text-[11px] font-bold text-grape-500">متابعة الحضور والتسميع المنجز لليوم</p>
                  </div>
                </div>

                <div>
                  {isTodayAbsent ? (
                    <span className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-black text-rose-700">
                      غائب اليوم ❌
                    </span>
                  ) : isTodayPresent ? (
                    <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-800">
                      حاضر في الحلقة ✓
                    </span>
                  ) : (
                    <span className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                      بانتظار بدء الجلسة
                    </span>
                  )}
                </div>
              </div>

              {/* بطاقات الحفظ والمراجعة */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* بطاقة الحفظ */}
                <div className="rounded-2xl border border-grape-100 bg-gradient-to-br from-grape-50/40 to-white p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-display text-sm font-extrabold text-grape-800">
                      <Icon name="book" className="h-4 w-4 text-grape-600" />
                      ورد الحفظ الجديد
                    </span>
                    {hasTodayMem ? (
                      <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                        {todayRating?.h === "very-good" ? "جيد جدًا" : "ممتاز ✓"}
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
                        لم يُسمّع بعد
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-ink truncate">
                    {todayWard?.memorization?.trim() || "الورد المحدد قيد المتابعة"}
                  </p>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-grape-600 pt-1 border-t border-grape-100/60">
                    <span>{ar(todayWard?.memorizationVerses || 0)} آية</span>
                    <span>&bull;</span>
                    <span>{ar(todayWard?.memorizationLines || 0)} سطر</span>
                    <span>&bull;</span>
                    <span className="text-grape-800">{n(todayMemPages)} صفحة</span>
                  </div>
                </div>

                {/* بطاقة المراجعة */}
                <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/30 to-white p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-display text-sm font-extrabold text-amber-900">
                      <Icon name="refresh" className="h-4 w-4 text-amber-600" />
                      ورد المراجعة اليومي
                    </span>
                    {hasTodayRev ? (
                      <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                        {todayRating?.r === "very-good" ? "جيد جدًا" : "ممتاز ✓"}
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
                        لم يُسمّع بعد
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-ink truncate">
                    {todayWard?.review?.trim() || "الورد المحدد قيد المتابعة"}
                  </p>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-800 pt-1 border-t border-amber-100">
                    <span>{ar(todayWard?.reviewVerses || 0)} آية</span>
                    <span>&bull;</span>
                    <span>{ar(todayWard?.reviewLines || 0)} سطر</span>
                    <span>&bull;</span>
                    <span className="text-amber-950">{n(todayRevPages)} صفحة</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ب) شريط الأيام الأربعة للأسبوع التعليمي (أحد - أربعاء) */}
            <section className="rounded-[24px] border border-grape-200/80 bg-white p-4 sm:p-5 shadow-xs">
              <h4 className="font-display text-sm font-extrabold text-ink mb-3 flex items-center gap-2">
                <span>📅</span>
                <span>سجل الأيام الأسبوعي (الأحد إلى الأربعاء)</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DAYS.map((d, idx) => {
                  const dayState = student.days?.[d.key];
                  const dayRating = student.recitationRatings?.[d.key];
                  const dayDate = addCalendarDays(weekStartDateIso || localDateKey(teachingWeekStart()), idx);
                  const isPastOrToday = idx <= activeDayIndex;
                  const isDayAbsent = dayState?.absent === true;
                  const isDayPresent = dayState?.a === true && !isDayAbsent;
                  const hasDoneMem = isDayPresent && (dayState?.h || dayRating?.h === "excellent" || dayRating?.h === "very-good");
                  const hasDoneRev = isDayPresent && (dayState?.r || dayRating?.r === "excellent" || dayRating?.r === "very-good");

                  return (
                    <div
                      key={d.key}
                      className={`rounded-2xl border p-3 flex flex-col justify-between transition ${
                        isDayAbsent
                          ? "border-rose-200 bg-rose-50/40"
                          : hasDoneMem && hasDoneRev
                          ? "border-emerald-200 bg-emerald-50/40"
                          : isDayPresent
                          ? "border-sky-200 bg-sky-50/40"
                          : isPastOrToday
                          ? "border-slate-200 bg-slate-50/50"
                          : "border-slate-100 bg-white opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-display text-xs font-black text-ink">{d.label}</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {formatHijriDate(dayDate, { day: "numeric", month: "numeric" })}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] font-bold">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">حضور:</span>
                          <span className={isDayAbsent ? "text-rose-600 font-black" : isDayPresent ? "text-emerald-700 font-black" : "text-slate-400"}>
                            {isDayAbsent ? "غياب" : isDayPresent ? "حاضر ✓" : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">حفظ:</span>
                          <span className={hasDoneMem ? "text-emerald-700 font-black" : "text-slate-400"}>
                            {hasDoneMem ? "أنجز ✓" : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">مراجعة:</span>
                          <span className={hasDoneRev ? "text-emerald-700 font-black" : "text-slate-400"}>
                            {hasDoneRev ? "أنجز ✓" : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ج) الإحصائيات البيانية */}
            <section className="rounded-[24px] border border-grape-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold-400/20 text-gold-700 text-base">
                    📈
                  </span>
                  <h3 className="font-display text-base font-extrabold text-ink">
                    إحصائيات الإنجاز والتطور
                  </h3>
                </div>

                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("today")}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                      statsPeriod === "today" ? "bg-white text-grape-700 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("week")}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                      statsPeriod === "week" ? "bg-white text-grape-700 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    هذا الأسبوع
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("month")}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                      statsPeriod === "month" ? "bg-white text-grape-700 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    هذا الشهر ({currentMonthName})
                  </button>
                </div>
              </div>

              {/* 1. إحصائيات اليوم */}
              {statsPeriod === "today" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 anim-fade">
                  <div className="rounded-2xl border border-grape-100 bg-grape-50/40 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-grape-600">صفحات الحفظ اليوم</p>
                    <p className="mt-1 font-display text-xl font-black text-grape-900">{n(todayMemPages)} ص</p>
                    <p className="text-[10px] font-bold text-grape-400 mt-0.5">{ar(todayWard?.memorizationVerses || 0)} آية</p>
                  </div>
                  <div className="rounded-2xl border border-gold-200 bg-gold-50/40 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-gold-700">صفحات المراجعة اليوم</p>
                    <p className="mt-1 font-display text-xl font-black text-gold-900">{n(todayRevPages)} ص</p>
                    <p className="text-[10px] font-bold text-gold-600 mt-0.5">{ar(todayWard?.reviewVerses || 0)} آية</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-emerald-700">الحضور اليومي</p>
                    <p className="mt-1 font-display text-base font-black text-emerald-800">
                      {isTodayAbsent ? "غياب ❌" : isTodayPresent ? "حاضر ✓" : "لم يبدأ"}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-0.5">تسجيل مباشر</p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-sky-700">التقييم اليومي</p>
                    <p className="mt-1 font-display text-base font-black text-sky-800">
                      {hasTodayMem || hasTodayRev ? (todayRating?.h === "very-good" || todayRating?.r === "very-good" ? "جيد جدًا" : "ممتاز ✓") : "بانتظار التسميع"}
                    </p>
                    <p className="text-[10px] font-bold text-sky-600 mt-0.5">درجة الإتقان</p>
                  </div>
                </div>
              )}

              {/* 2. إحصائيات هذا الأسبوع */}
              {statsPeriod === "week" && (
                <div className="space-y-3 anim-fade">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-2xl border border-grape-100 bg-grape-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-grape-600">مجموع الحفظ</p>
                      <p className="mt-1 font-display text-xl font-black text-grape-900">{n(currWeekMemPages)} ص</p>
                      <p className="text-[10px] font-bold text-grape-400 mt-0.5">خلال الأسبوع</p>
                    </div>
                    <div className="rounded-2xl border border-gold-200 bg-gold-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-gold-700">مجموع المراجعة</p>
                      <p className="mt-1 font-display text-xl font-black text-gold-900">{n(currWeekRevPages)} ص</p>
                      <p className="text-[10px] font-bold text-gold-600 mt-0.5">خلال الأسبوع</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-emerald-700">أيام الحضور</p>
                      <p className="mt-1 font-display text-xl font-black text-emerald-800">{ar(currPresent)} أيام</p>
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{currAbsent > 0 ? `${ar(currAbsent)} غياب` : "بدون غياب ✓"}</p>
                    </div>
                    <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-purple-700">مستوى الأداء</p>
                      <p className="mt-1 font-display text-base font-black text-purple-800">
                        {currWeekExcellentCount >= currWeekVeryGoodCount ? "ممتاز مرتفع" : "جيد جدًا"}
                      </p>
                      <p className="text-[10px] font-bold text-purple-600 mt-0.5">
                        {guidance?.overallStatus === "improving" ? "في مسار تحسن ↗" : guidance?.overallStatus === "needs-attention" ? "يحتاج متابعة ↘" : "أداء مستقر →"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. إحصائيات هذا الشهر */}
              {statsPeriod === "month" && (
                <div className="space-y-3 anim-fade">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-2xl border border-grape-100 bg-grape-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-grape-600">إجمالي الحفظ الشهري</p>
                      <p className="mt-1 font-display text-xl font-black text-grape-900">{n(monthMemPages)} ص</p>
                      <p className="text-[10px] font-bold text-grape-400 mt-0.5">طوال شهر {currentMonthName}</p>
                    </div>
                    <div className="rounded-2xl border border-gold-200 bg-gold-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-gold-700">إجمالي المراجعة</p>
                      <p className="mt-1 font-display text-xl font-black text-gold-900">{n(monthRevPages)} ص</p>
                      <p className="text-[10px] font-bold text-gold-600 mt-0.5">طوال شهر {currentMonthName}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-emerald-700">حضور الشهر</p>
                      <p className="mt-1 font-display text-xl font-black text-emerald-800">{ar(monthPresent)} يوم</p>
                      <p className="text-[10px] font-bold text-rose-600 mt-0.5">{monthAbsent > 0 ? `${ar(monthAbsent)} غياب` : "التزام تام ✓"}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-sky-700">متوسط التقييم</p>
                      <p className="mt-1 font-display text-base font-black text-sky-800">
                        {monthExcCount >= monthVgCount ? "امتياز عام" : "جيد جدًا مرتفع"}
                      </p>
                      <p className="text-[10px] font-bold text-sky-600 mt-0.5">تطور مستمر</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-700 leading-relaxed">
                    مقارنة وتطور الشهر: {guidance?.comparisonText || "أظهر الطالب التزامًا ملحوظًا واستقرارًا في معدلات الإنجاز بين بداية الشهر ونهايته."}
                  </div>
                </div>
              )}
            </section>

            {/* د) نصائح وتوجيهات الذكاء الاصطناعي التربوية */}
            {guidance && (
              <section className="rounded-[24px] border border-grape-200/80 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700 text-base">
                      💡
                    </span>
                    <div>
                      <h3 className="font-display text-base font-extrabold text-ink">
                        نصائح وتوجيهات لتطوير الطالب
                      </h3>
                      <p className="text-[11px] font-bold text-grape-500">تحليل مبني على السجلات التراكمية ومبادئ الحفظ المعتمدة</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-black ${
                    guidance.overallStatus === "excellent" ? "bg-emerald-100 text-emerald-800" :
                    guidance.overallStatus === "improving" ? "bg-sky-100 text-sky-800" :
                    guidance.overallStatus === "needs-attention" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                  }`}>
                    {guidance.headline}
                  </span>
                </div>

                <div className="rounded-2xl bg-grape-50/50 border border-grape-200/70 p-4 text-xs font-bold text-grape-900 leading-relaxed">
                  <p className="font-display font-extrabold text-sm mb-1 text-ink">ملخص الملاحظات التراكمية:</p>
                  {guidance.summary}
                </div>

                {/* كروت التوجيهات */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {guidance.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`rounded-2xl border p-4 flex flex-col justify-between space-y-2.5 transition ${
                        rec.tone === "mint" ? "border-emerald-200 bg-emerald-50/20" :
                        rec.tone === "gold" ? "border-amber-200 bg-amber-50/20" :
                        rec.tone === "coral" ? "border-rose-200 bg-rose-50/20" : "border-purple-200 bg-purple-50/20"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            rec.tone === "mint" ? "bg-emerald-100 text-emerald-800" :
                            rec.tone === "gold" ? "bg-amber-100 text-amber-800" :
                            rec.tone === "coral" ? "bg-rose-100 text-rose-800" : "bg-purple-100 text-purple-800"
                          }`}>
                            {rec.badge}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-extrabold text-ink">
                          {rec.title}
                        </h4>
                        <p className="mt-1 text-xs font-bold text-slate-600 leading-relaxed">
                          {rec.body}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
                        {rec.educationalPrinciple}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 6. التبويب الثاني: متجر الجوائز — 2-Column Grid على الجوال ومقاسات مربعة متناسقة ومريحة */}
        {activeTab === "store" && (
          <div className="space-y-4">
            {!parentStoreOpen ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xs">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700 text-3xl mb-3">
                  🔒
                </span>
                <h3 className="font-display text-lg font-extrabold text-ink">متجر الجوائز مغلق حاليًا</h3>
                <p className="mt-2 text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                  يفتح المعلم المتجر في أوقات محددة لمكافأة الطلاب والشراء بعملاتهم المكتسبة من إنجاز الحفظ والمراجعة.
                </p>
                <div className="mt-4 inline-block rounded-xl border border-gold-200 bg-gold-50 px-4 py-2 text-xs font-black text-gold-900">
                  رصيد الطالب: {ar(student.coins)} 🪙
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* شريط الرصيد */}
                <div className="rounded-2xl border border-gold-300 bg-gradient-to-l from-amber-500/15 via-gold-50/50 to-white p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-gold-950">متجر الجوائز والمكافآت</h3>
                    <p className="text-xs font-bold text-gold-800">اشترِ لابنك الجوائز والهدايا باستخدام عملاته التي جمعها من الحفظ</p>
                  </div>
                  <div className="rounded-xl bg-white px-3.5 py-1.5 font-display text-sm font-black text-gold-900 border border-gold-200 shadow-2xs">
                    الرصيد المتوفر: {ar(student.coins)} 🪙
                  </div>
                </div>

                {/* شبكة المنتجات: عمودين تماماً على الجوال بحجم مربعات متوسطة متناسقة */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
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
                        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-2.5 sm:p-3 shadow-xs transition hover:shadow-md ${
                          cantBuy ? "border-slate-200 opacity-75" : "border-slate-200 hover:border-grape-300"
                        }`}
                      >
                        <div>
                          {/* حاوية الصور الموحدة الأبعاد بدون قص وبدون تشوه */}
                          <div className="relative h-24 sm:h-28 md:h-32 w-full overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center p-1.5 border border-slate-100 mb-2">
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
                              <div className="grid h-full w-full place-items-center text-grape-400">
                                <Icon name={p.icon || "gift"} className="h-8 w-8" />
                              </div>
                            )}

                            {locked && (
                              <span className="absolute top-1.5 end-1.5 rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur-xs">
                                م{ar(p.minLevel)}
                              </span>
                            )}
                          </div>

                          {/* اسم المنتج وسعره */}
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="font-display text-xs sm:text-sm font-extrabold text-ink truncate">{p.name}</h4>
                            <span className="rounded-lg bg-gold-100/90 border border-gold-300/80 px-1.5 py-0.5 text-[11px] font-black text-gold-900 whitespace-nowrap">
                              {ar(p.price)} 🪙
                            </span>
                          </div>

                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 line-clamp-1 min-h-[16px]">
                            {p.desc}
                          </p>

                          <div className="mt-1 text-[10px] font-extrabold text-slate-400">
                            {hasStockLimit ? (outOfStock ? "نفدت الكمية" : `باقٍ: ${ar(p.stock ?? 0)}`) : "متوفر"}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={cantBuy}
                            onClick={() => addToCart(p)}
                            className="w-full rounded-xl bg-grape-600 py-1.5 sm:py-2 text-[11px] sm:text-xs font-black text-white hover:bg-grape-700 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                          >
                            {locked ? `مقفل (م${ar(p.minLevel)})` : soldOut ? "مملوك مسبقًا" : outOfStock ? "نفدت الكمية" : poor ? "العملات لا تكفي" : "+ أضف للسلة"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* شريط السلة العائم */}
                {cart.length > 0 && (
                  <div className="fixed bottom-4 inset-x-4 max-w-4xl mx-auto z-40 rounded-2xl border-2 border-grape-300 bg-white p-3.5 sm:p-4 shadow-2xl anim-slide-up">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-extrabold text-ink">سلة المشتريات ({ar(cart.length)} عناصر)</span>
                          <span className="font-display text-xs font-black text-gold-950 bg-gold-100 px-2.5 py-0.5 rounded-lg border border-gold-300">
                            المجموع: {ar(cartTotal)} 🪙
                          </span>
                        </div>
                        {/* كل منتج بزر حذف مستقل */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cart.map((c) => {
                            const p = products.find((x) => x.id === c.itemId);
                            if (!p) return null;
                            return (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-grape-50 border border-grape-200 px-2.5 py-1 text-xs font-extrabold text-grape-800 shadow-2xs"
                              >
                                <span>{p.name} {c.qty > 1 ? `(${ar(c.qty)})` : ""}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(c.id)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full h-5 w-5 grid place-items-center text-xs font-black ms-1 transition"
                                  title="حذف هذا المنتج فقط من السلة"
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
                          className="rounded-xl bg-gold-500 px-5 py-2.5 font-display text-xs sm:text-sm font-black text-ink shadow-[0_3px_0_#b57a0a] hover:bg-gold-600 transition active:translate-y-0.5 disabled:opacity-40"
                        >
                          {isSubmitting ? "جارٍ الشراء..." : "تأكيد الشراء بالعملات ✓"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 7. التبويب الثالث: سجل المشتريات */}
        {activeTab === "purchases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-display text-base font-extrabold text-ink">
                سجل المشتريات والجوائز المؤرخة ({ar(studentOrders.length)})
              </h3>
              <span className="text-xs font-bold text-slate-500">
                تسليم يدوي موثق من معلم الحلقة
              </span>
            </div>

            {studentOrders.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-2xl mb-2">
                  🛍️
                </span>
                <p className="font-display text-base font-extrabold text-ink">لا توجد مشتريات مسجلة بعد</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  عند شراء منتج أو جائزة من المتجر، ستظهر هنا فورًا مع حالة تسليمها.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {studentOrders.map((order) => {
                  const isDone = order.status === "delivered";
                  const pDate = new Date(order.purchasedAt);

                  return (
                    <div
                      key={order.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-2xs transition ${
                        isDone ? "border-emerald-200 bg-emerald-50/20" : "border-amber-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1">
                          {order.itemImage ? (
                            <img src={order.itemImage} alt={order.itemName} className="h-full w-full object-contain" />
                          ) : (
                            <Icon name={order.itemIcon || "gift"} className="h-6 w-6 text-grape-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-display text-sm font-extrabold text-ink truncate">
                            {order.itemName}
                          </h4>
                          <p className="text-[11px] font-bold text-slate-500">
                            الكمية: {ar(order.qty ?? 1)} &bull; {ar(order.price)} 🪙
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            #{order.id.slice(0, 8)} &bull; {pDate.toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <span className="rounded-xl bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                            تم التسليم ✓
                          </span>
                        ) : (
                          <span className="rounded-xl bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
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
      </main>

      <footer className="text-center pt-8 text-xs font-bold text-slate-400">
        منصة نور الحفّاظ &bull; متابعة حصرية للطالب {student.name}
      </footer>
    </div>
  );
}
