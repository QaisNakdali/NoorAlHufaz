/* بوابة خاصة بأولياء الأمور — متابعة حصرية للمستوى والأداء اليومي وإحصائيات متكاملة ومتجر تفاعلي */
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
  id: string; // معرف فريد لكل سطر داخل السلة لمنع حذف السلة بالكامل
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

  // البحث عن الطالب المطابق لرمز الوصول
  const student = useMemo(() => {
    if (!token || !token.trim()) return null;
    return students.find((s) => s.parentAccessToken === token.trim()) || null;
  }, [students, token]);

  // إدارة السلة واستمرارها بعد Refresh
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

  // نصائح وتوجيهات الذكاء الاصطناعي التربوية المستندة لبيانات الطالب
  const guidance = useMemo(() => {
    if (!student) return null;
    return generateParentAIGuidance(student, weeksLog, parentContacts);
  }, [student, weeksLog, parentContacts]);

  // تسجيل النشاط
  useEffect(() => {
    if (student) {
      logParentAccess(student.id, activeTab === "store");
    }
  }, [student, activeTab, logParentAccess]);

  // حالة الرابط غير الصالح
  if (!student) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="max-w-md w-full rounded-3xl border-2 border-grape-200 bg-white p-6 sm:p-8 shadow-xl">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral-100 text-coral-600 mb-4">
            <Icon name="alert" className="h-8 w-8" strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-xl font-extrabold text-ink">
            هذا الرابط لم يعد متاحًا
          </h2>
          <p className="mt-3 text-sm font-bold text-grape-600 leading-relaxed">
            يرجى التواصل مع إدارة الحلقة أو معلم الطالب للحصول على رابط المتابعة الصحيح والخاص بالطالب.
          </p>
          <div className="mt-6 pt-4 border-t border-grape-100 text-xs font-bold text-grape-400">
            نور الحفّاظ &bull; منصة التحفيظ والمتابعة التفاعلية
          </div>
        </div>
      </div>
    );
  }

  const { level } = levelInfo(student.xp);

  // حساب يوم اليوم الفعلي في الأسبوع
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

  // إحصائيات الشهر الحالي (الهجري والفعلي)
  const currentMonthKey = hijriMonthKey(today);
  const currentMonthName = new Intl.DateTimeFormat("ar", { month: "long" }).format(today);

  // تجميع سجلات الشهر الحالي من الأسابيع السابقة + الأسبوع الحالي
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
    if (log.week === week) continue; // تجنب حساب الأسبوع الحالي مرتين
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

  // إدارة السلة الذكية مع ID مستقل لكل منتج
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

  // حذف العنصر المحدد فقط بواسطة ID المستقل
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
      {/* 1. الشريط العلوي المطابق لهوية المنصة */}
      <header className="sticky top-0 z-30 border-b border-grape-100 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_10px_30px_-25px_rgba(55,29,104,.4)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-block rounded-2xl shadow-[0_10px_25px_-12px_rgba(75,47,157,.8)]">
              <svg viewBox="0 0 24 24" className="h-10 w-10">
                <defs>
                  <linearGradient id="parent-logo-grad" x1="3" y1="2" x2="21" y2="22">
                    <stop stopColor="#8870f2" />
                    <stop offset="1" stopColor="#583bc3" />
                  </linearGradient>
                </defs>
                <rect width="24" height="24" rx="7" fill="url(#parent-logo-grad)" />
                <path d="M12 4.2l2.05 4.4 4.8.7-3.48 3.4.82 4.78L12 15.25l-4.19 2.23.82-4.78-3.48-3.4 4.8-.7z" fill="#f9da73" />
              </svg>
            </span>
            <div>
              <h1 className="font-display text-lg font-extrabold text-ink leading-tight">
                نور الحفّاظ <span className="text-xs font-bold text-grape-600 font-sans">| بوابة ولي الأمر</span>
              </h1>
              <p className="text-[11px] font-bold text-grape-500">متابعة دقيقة · إنجاز يومي · تشجيع مستمر</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-grape-100 border border-grape-200 px-3 py-1 text-xs font-extrabold text-grape-700">
              {formatTeachingWeekRange(weekStartDateIso || localDateKey(teachingWeekStart()))}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-5 space-y-5">
        {/* 2. بطاقة الطالب الرئيسية (Hero Profile Card) */}
        <section className="relative overflow-hidden rounded-[28px] border-2 border-grape-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar photo={student.photo} name={student.name} size={68} frame={student.frame} crown={student.crown} glow={student.glow} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">
                    {student.name}
                  </h2>
                  <span className="rounded-full bg-grape-600 px-3 py-0.5 font-display text-xs font-extrabold text-white shadow-xs">
                    المستوى {ar(level)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-grape-600">
                  <span className="rounded-full bg-grape-50 border border-grape-200 px-2.5 py-0.5">
                    حلقة: {halaqa?.name || "حلقة القرآن"}
                  </span>
                  <span className="rounded-full bg-mint-50 border border-mint-200 text-mint-700 px-2.5 py-0.5">
                    الرمز: #{student.parentAccessToken?.slice(0, 6) || "مفعّل"}
                  </span>
                </div>
              </div>
            </div>

            {/* الأرصدة والمؤشرات الرقمية */}
            <div className="flex flex-wrap items-center gap-2.5 ms-auto sm:ms-0">
              <div className="rounded-2xl border-2 border-gold-400/40 bg-gold-400/15 px-3.5 py-2 text-center min-w-[75px]">
                <span className="block text-[10px] font-extrabold text-gold-700">العملات</span>
                <span className="flex items-center justify-center gap-1 font-display text-base sm:text-lg font-black text-gold-900">
                  <Coin className="h-4 w-4" />
                  {ar(student.coins)}
                </span>
              </div>

              <div className="rounded-2xl border-2 border-grape-200 bg-grape-50/60 px-3.5 py-2 text-center min-w-[75px]">
                <span className="block text-[10px] font-extrabold text-grape-500">النقاط</span>
                <span className="flex items-center justify-center gap-1 font-display text-base sm:text-lg font-black text-grape-700">
                  <Icon name="bolt" fill className="h-4 w-4 text-grape-600" />
                  {ar(student.xp)}
                </span>
              </div>

              <div className="rounded-2xl border-2 border-coral-200 bg-coral-50/50 px-3.5 py-2 text-center min-w-[75px]">
                <span className="block text-[10px] font-extrabold text-coral-600">القلوب</span>
                <div className="mt-0.5 flex justify-center">
                  <HeartsRow hearts={student.hearts} max={3} size="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. تنبيه الاختبار القادم (يظهر فقط إذا كان مجدولاً للطالب) */}
        {student.isTesting && (
          <section className="relative overflow-hidden rounded-[24px] border-2 border-amber-400 bg-gradient-to-l from-amber-500/10 via-amber-400/5 to-white p-4 sm:p-5 shadow-[0_0_25px_rgba(245,158,11,0.22)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white font-black text-xl shadow-xs">
                  📝
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-xs font-black">
                      اختبار قادم
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-extrabold text-ink">
                      الطالب مرشح لاختبار مرحلي في الحلقة
                    </h3>
                  </div>
                  <p className="mt-1 text-xs font-bold text-grape-600 leading-relaxed">
                    المطلوب: مراجعة وضبط المقاطع المحددة تمهيدًا للاختبار مع المعلم. يُرجى تشجيع الطالب على التسميع المسبق بالمنزل.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. تبويبات البوابة الرئيسية */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-grape-200 bg-white p-1.5 shadow-xs">
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
            <span>متجر الهدايا</span>
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

        {/* 5. محتوى التبويب الأول: لوحة المتابعة */}
        {activeTab === "progress" && (
          <div className="space-y-5">
            {/* أ) قسم أداء اليوم */}
            <section className="rounded-3xl border-2 border-grape-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grape-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-grape-100 text-grape-700 text-base">
                    📊
                  </span>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-ink">
                      أداء اليوم · {todayDateStr}
                    </h3>
                    <p className="text-[11px] font-bold text-grape-500">حالة الحضور والتسميع اليومية الفعلية</p>
                  </div>
                </div>

                <div>
                  {isTodayAbsent ? (
                    <span className="rounded-full bg-coral-100 border border-coral-200 px-3 py-1 text-xs font-black text-coral-700">
                      غائب اليوم ❌
                    </span>
                  ) : isTodayPresent ? (
                    <span className="rounded-full bg-mint-100 border border-mint-200 px-3 py-1 text-xs font-black text-mint-800">
                      حاضر في الحلقة ✓
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                      بانتظار بدء الجلسة
                    </span>
                  )}
                </div>
              </div>

              {/* بطاقات الحفظ والمراجعة لليوم */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* الحفظ اليومي */}
                <div className="rounded-2xl border-2 border-grape-100 bg-grape-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-display text-sm font-extrabold text-grape-800">
                      <Icon name="book" className="h-4 w-4 text-grape-600" />
                      ورد الحفظ اليومي
                    </span>
                    {hasTodayMem ? (
                      <span className="rounded-md bg-mint-600 px-2 py-0.5 text-[11px] font-black text-white">
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
                  <div className="flex items-center gap-2 text-xs font-extrabold text-grape-600">
                    <span>الكمية: {ar(todayWard?.memorizationVerses || 0)} آية</span>
                    <span>&bull;</span>
                    <span>{ar(todayWard?.memorizationLines || 0)} سطر</span>
                    <span>&bull;</span>
                    <span>{n(todayMemPages)} صفحة</span>
                  </div>
                </div>

                {/* المراجعة اليومية */}
                <div className="rounded-2xl border-2 border-gold-200/80 bg-gold-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-display text-sm font-extrabold text-gold-900">
                      <Icon name="refresh" className="h-4 w-4 text-gold-600" />
                      ورد المراجعة اليومي
                    </span>
                    {hasTodayRev ? (
                      <span className="rounded-md bg-mint-600 px-2 py-0.5 text-[11px] font-black text-white">
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
                  <div className="flex items-center gap-2 text-xs font-extrabold text-gold-800">
                    <span>الكمية: {ar(todayWard?.reviewVerses || 0)} آية</span>
                    <span>&bull;</span>
                    <span>{ar(todayWard?.reviewLines || 0)} سطر</span>
                    <span>&bull;</span>
                    <span>{n(todayRevPages)} صفحة</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ب) الإحصائيات (اليوم / هذا الأسبوع / هذا الشهر) */}
            <section className="rounded-3xl border-2 border-grape-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grape-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold-400/20 text-gold-700 text-base">
                    📈
                  </span>
                  <h3 className="font-display text-base font-extrabold text-ink">
                    إحصائيات الإنجاز والتطور
                  </h3>
                </div>

                <div className="flex rounded-xl bg-grape-50 p-1 border border-grape-200/60">
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("today")}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                      statsPeriod === "today" ? "bg-white text-grape-700 shadow-xs" : "text-grape-500 hover:text-grape-700"
                    }`}
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("week")}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                      statsPeriod === "week" ? "bg-white text-grape-700 shadow-xs" : "text-grape-500 hover:text-grape-700"
                    }`}
                  >
                    هذا الأسبوع
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("month")}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                      statsPeriod === "month" ? "bg-white text-grape-700 shadow-xs" : "text-grape-500 hover:text-grape-700"
                    }`}
                  >
                    هذا الشهر ({currentMonthName})
                  </button>
                </div>
              </div>

              {/* 1. إحصائيات اليوم */}
              {statsPeriod === "today" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-fade">
                  <div className="rounded-2xl border border-grape-100 bg-grape-50/50 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-grape-500">صفحات الحفظ اليوم</p>
                    <p className="mt-1 font-display text-xl font-black text-grape-800">{n(todayMemPages)} ص</p>
                    <p className="text-[10px] font-bold text-grape-400 mt-0.5">{ar(todayWard?.memorizationVerses || 0)} آية</p>
                  </div>
                  <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-gold-700">صفحات المراجعة اليوم</p>
                    <p className="mt-1 font-display text-xl font-black text-gold-800">{n(todayRevPages)} ص</p>
                    <p className="text-[10px] font-bold text-gold-600 mt-0.5">{ar(todayWard?.reviewVerses || 0)} آية</p>
                  </div>
                  <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-3.5 text-center">
                    <p className="text-[11px] font-bold text-mint-700">الحضور اليومي</p>
                    <p className="mt-1 font-display text-base font-black text-mint-800">
                      {isTodayAbsent ? "غياب" : isTodayPresent ? "حاضر ✓" : "لم يبدأ"}
                    </p>
                    <p className="text-[10px] font-bold text-mint-600 mt-0.5">تسجيل فوري</p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-3.5 text-center">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-grape-100 bg-grape-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-grape-500">مجموع الحفظ</p>
                      <p className="mt-1 font-display text-xl font-black text-grape-800">{n(currWeekMemPages)} ص</p>
                      <p className="text-[10px] font-bold text-grape-400 mt-0.5">هذا الأسبوع</p>
                    </div>
                    <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-gold-700">مجموع المراجعة</p>
                      <p className="mt-1 font-display text-xl font-black text-gold-800">{n(currWeekRevPages)} ص</p>
                      <p className="text-[10px] font-bold text-gold-600 mt-0.5">هذا الأسبوع</p>
                    </div>
                    <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-mint-700">أيام الحضور</p>
                      <p className="mt-1 font-display text-xl font-black text-mint-800">{ar(currPresent)} أيام</p>
                      <p className="text-[10px] font-bold text-mint-600 mt-0.5">{currAbsent > 0 ? `${ar(currAbsent)} غياب` : "بدون غياب ✓"}</p>
                    </div>
                    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-3.5 text-center">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-grape-100 bg-grape-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-grape-500">إجمالي الحفظ الشهري</p>
                      <p className="mt-1 font-display text-xl font-black text-grape-800">{n(monthMemPages)} ص</p>
                      <p className="text-[10px] font-bold text-grape-400 mt-0.5">طوال شهر {currentMonthName}</p>
                    </div>
                    <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-gold-700">إجمالي المراجعة</p>
                      <p className="mt-1 font-display text-xl font-black text-gold-800">{n(monthRevPages)} ص</p>
                      <p className="text-[10px] font-bold text-gold-600 mt-0.5">طوال شهر {currentMonthName}</p>
                    </div>
                    <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-mint-700">الحضور الإجمالي</p>
                      <p className="mt-1 font-display text-xl font-black text-mint-800">{ar(monthPresent)} حضور</p>
                      <p className="text-[10px] font-bold text-coral-600 mt-0.5">{monthAbsent > 0 ? `${ar(monthAbsent)} غياب` : "التزام تام"}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-3.5 text-center">
                      <p className="text-[11px] font-bold text-sky-700">متوسط التقييم</p>
                      <p className="mt-1 font-display text-base font-black text-sky-800">
                        {monthExcCount >= monthVgCount ? "امتياز عام" : "جيد جدًا مرتفع"}
                      </p>
                      <p className="text-[10px] font-bold text-sky-600 mt-0.5">تطور مستمر</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 text-xs font-bold text-grape-600 leading-relaxed">
                    مقارنة وتطور الشهر: {guidance?.comparisonText || "أظهر الطالب التزامًا ملحوظًا واستقرارًا في معدلات الإنجاز بين بداية الشهر ونهايته."}
                  </div>
                </div>
              )}
            </section>

            {/* ج) نصائح الذكاء الاصطناعي لتطوير الطالب المستندة إلى المبادئ التعليمية والبيانات */}
            {guidance && (
              <section className="rounded-3xl border-2 border-grape-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grape-100 pb-3">
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
                    guidance.overallStatus === "excellent" ? "bg-mint-100 text-mint-800" :
                    guidance.overallStatus === "improving" ? "bg-sky-100 text-sky-800" :
                    guidance.overallStatus === "needs-attention" ? "bg-amber-100 text-amber-800" : "bg-grape-100 text-grape-800"
                  }`}>
                    {guidance.headline}
                  </span>
                </div>

                <div className="rounded-2xl bg-grape-50/60 border border-grape-200/80 p-4 text-xs font-bold text-grape-800 leading-relaxed">
                  <p className="font-display font-extrabold text-sm mb-1 text-ink">ملخص الملاحظات التراكمية:</p>
                  {guidance.summary}
                </div>

                {/* كروت التوجيهات والمبادئ التعليمية */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {guidance.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`rounded-2xl border-2 p-4 flex flex-col justify-between space-y-2.5 transition ${
                        rec.tone === "mint" ? "border-mint-200 bg-mint-50/30" :
                        rec.tone === "gold" ? "border-gold-200 bg-gold-50/30" :
                        rec.tone === "coral" ? "border-coral-200 bg-coral-50/30" : "border-grape-200 bg-grape-50/30"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            rec.tone === "mint" ? "bg-mint-100 text-mint-800" :
                            rec.tone === "gold" ? "bg-gold-100 text-gold-800" :
                            rec.tone === "coral" ? "bg-coral-100 text-coral-800" : "bg-grape-100 text-grape-800"
                          }`}>
                            {rec.badge}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-extrabold text-ink">
                          {rec.title}
                        </h4>
                        <p className="mt-1 text-xs font-bold text-grape-700/80 leading-relaxed">
                          {rec.body}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-grape-100/60 text-[10px] font-bold text-grape-400">
                        {rec.educationalPrinciple}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 6. محتوى التبويب الثاني: متجر الطالب مع صور متناسقة وسلة آمنة */}
        {activeTab === "store" && (
          <div className="space-y-5">
            {!parentStoreOpen ? (
              <div className="rounded-3xl border-2 border-grape-200 bg-white p-10 text-center shadow-sm">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700 text-3xl mb-3">
                  🔒
                </span>
                <h3 className="font-display text-lg font-extrabold text-ink">متجر الهدايا مغلق حاليًا</h3>
                <p className="mt-2 text-xs font-bold text-grape-600 max-w-md mx-auto leading-relaxed">
                  يفتح المعلم المتجر في أوقات محددة لمكافأة الطلاب والشراء بعملاتهم المكتسبة.
                </p>
                <div className="mt-4 inline-block rounded-xl border border-gold-200 bg-gold-50 px-4 py-2 text-xs font-black text-gold-800">
                  رصيد الطالب: {ar(student.coins)} 🪙
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* شريط الرصيد */}
                <div className="rounded-2xl border-2 border-gold-200 bg-gradient-to-l from-gold-400/20 via-gold-50 to-white p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-gold-950">متجر الجوائز والمكافآت</h3>
                    <p className="text-xs font-bold text-gold-800">اشترِ لابنك الجوائز والهدايا باستخدام عملاته التي جمعها من الحفظ</p>
                  </div>
                  <div className="rounded-xl bg-white px-3.5 py-1.5 font-display text-sm font-black text-gold-900 border border-gold-200 shadow-2xs">
                    الرصيد المتوفر: {ar(student.coins)} 🪙
                  </div>
                </div>

                {/* شبكة المنتجات بتصميم حديث وأبعاد موحدة */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
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
                        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 bg-white p-3 shadow-xs transition hover:shadow-md ${
                          cantBuy ? "border-grape-100 opacity-80" : "border-grape-200 hover:border-grape-400"
                        }`}
                      >
                        <div>
                          {/* حاوية صورة موحدة مع object-fit: contain */}
                          <div className="relative h-32 sm:h-36 w-full overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center p-2 border border-slate-100 mb-2">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="max-h-full max-w-full object-contain drop-shadow-xs transition duration-200 group-hover:scale-105" />
                            ) : isCosmetic ? (
                              <div className="h-full w-full flex items-center justify-center">
                                <CosmeticThumb slot={p.slot} value={p.value} />
                              </div>
                            ) : (
                              <div className="grid h-full w-full place-items-center text-grape-400">
                                <Icon name={p.icon || "gift"} className="h-10 w-10" />
                              </div>
                            )}

                            {locked && (
                              <span className="absolute top-1.5 end-1.5 rounded-full bg-grape-600 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                                م{ar(p.minLevel)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4 className="font-display text-sm font-extrabold text-ink truncate">{p.name}</h4>
                            <span className="rounded-full bg-gold-50 border border-gold-200 px-2 py-0.5 text-xs font-black text-gold-800 whitespace-nowrap">
                              {ar(p.price)} 🪙
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-grape-500 line-clamp-2 min-h-7 leading-4">{p.desc}</p>
                          <div className="mt-1 text-[10px] font-extrabold text-grape-400">
                            {hasStockLimit ? (outOfStock ? "نفدت الكمية" : `المتبقي: ${ar(p.stock ?? 0)}`) : "كمية متوفرة"}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-grape-100">
                          <button
                            type="button"
                            disabled={cantBuy}
                            onClick={() => addToCart(p)}
                            className="w-full rounded-xl bg-grape-600 py-2 text-xs font-black text-white hover:bg-grape-700 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                          >
                            {locked ? `مقفل (م${ar(p.minLevel)})` : soldOut ? "مملوك مسبقًا" : outOfStock ? "نفدت الكمية" : poor ? "العملات لا تكفي" : "+ أضف للسلة"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* شريط السلة العائم المحصن ضد الحذف الخاطئ */}
                {cart.length > 0 && (
                  <div className="fixed bottom-4 inset-x-4 max-w-4xl mx-auto z-40 rounded-2xl border-2 border-grape-300 bg-white p-4 shadow-2xl anim-slide-up">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-extrabold text-ink">سلة المشتريات ({ar(cart.length)} عناصر)</span>
                          <span className="font-display text-xs font-black text-gold-900 bg-gold-100 px-2.5 py-0.5 rounded-lg border border-gold-300">
                            المجموع: {ar(cartTotal)} 🪙
                          </span>
                        </div>
                        {/* كل منتج بزر X مستقل لحذف هذا المنتج فقط */}
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
                                  className="text-coral-500 hover:text-coral-700 hover:bg-coral-50 rounded-full h-5 w-5 grid place-items-center text-xs font-black ms-1 transition"
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

        {/* 7. محتوى التبويب الثالث: سجل المشتريات المؤرخة */}
        {activeTab === "purchases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-grape-100 pb-2.5">
              <h3 className="font-display text-base font-extrabold text-ink">
                سجل المشتريات والجوائز المؤرخة ({ar(studentOrders.length)})
              </h3>
              <span className="text-xs font-bold text-grape-500">
                تسليم يدوي موثق من معلم الحلقة
              </span>
            </div>

            {studentOrders.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white p-12 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl mb-2">
                  🛍️
                </span>
                <p className="font-display text-base font-extrabold text-ink">لا توجد مشتريات مسجلة بعد</p>
                <p className="mt-1 text-xs font-bold text-grape-500">
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
                      className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 shadow-xs transition ${
                        isDone ? "border-mint-200 bg-mint-50/20" : "border-gold-200 bg-white"
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
                          <p className="text-[11px] font-bold text-grape-500">
                            الكمية: {ar(order.qty ?? 1)} &bull; {ar(order.price)} 🪙
                          </p>
                          <p className="text-[10px] font-mono text-grape-400">
                            #{order.id.slice(0, 8)} &bull; {pDate.toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <span className="rounded-xl bg-mint-100 px-3 py-1 text-xs font-black text-mint-800">
                            تم التسليم ✓
                          </span>
                        ) : (
                          <span className="rounded-xl bg-gold-100 px-3 py-1 text-xs font-black text-gold-800">
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

      <footer className="text-center pt-8 text-xs font-bold text-grape-400">
        منصة نور الحفّاظ &bull; متابعة حصرية للطالب {student.name}
      </footer>
    </div>
  );
}
