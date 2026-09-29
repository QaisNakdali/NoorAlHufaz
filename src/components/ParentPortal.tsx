/* بوابة خاصة بأولياء الأمور — تصميم مودرن، فخم ومتجاوب بالكامل مع الجوال والحاسوب */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../appState";
import { generateParentAIGuidance, pagesForWardDay } from "../analytics";
import { ar, bagQty, DAYS, getWeekDayKey, levelInfo, type ShopItem, type Student, uid } from "../core";
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
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("week");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // العثور على الطالب بمرونة ودقة عبر رمز الوصول أو المعرف
  const student = useMemo(() => {
    if (!token || !token.trim()) return null;
    const cleanToken = token.trim();
    return students.find((s) => s.parentAccessToken === cleanToken || s.id === cleanToken) || null;
  }, [students, token]);

  // إدارة سلة المشتريات وحفظها محليًا
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

  // توليد التوجيهات التربوية الذكية بناءً على تاريخ الطالب
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
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="max-w-md w-full rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
            <Icon name="alert" className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-lg font-extrabold text-ink">
            رابط المتابعة غير متاح
          </h2>
          <p className="mt-2 text-xs font-bold text-slate-500 leading-relaxed">
            يرجى التأكد من الرابط أو التواصل مع معلم الحلقة للحصول على الرابط المحدّث للطالب.
          </p>
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-bold text-slate-400">
            منصة نور الحفّاظ &bull; متابعة القرآن الكريم
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

  // حساب يوم اليوم الفعلي في الأسبوع التعليمي (الأحد - الأربعاء)
  const today = new Date();
  const todayIso = localDateKey(today);
  const todayDayKey = getWeekDayKey(todayIso, weekStartDateIso);
  const activeDayIndex = Math.max(0, DAYS.findIndex((d) => d.key === todayDayKey));

  const todayState = student.days?.[todayDayKey];
  const todayWard = student.ward?.[todayDayKey];
  const todayRating = student.recitationRatings?.[todayDayKey];
  const todayDateStr = formatHijriDate(addCalendarDays(weekStartDateIso || localDateKey(teachingWeekStart()), activeDayIndex), { weekday: "long", day: "numeric", month: "long" });

  const isTodayAbsent = todayState?.absent === true || student.dailyAbsentDate === todayIso;
  const isTodayRecited = (student.dailyRecitedDate === todayIso || (todayState?.a === true && (todayState?.h || todayState?.r))) && !isTodayAbsent;

  const hasTodayMem = isTodayRecited && Boolean(todayState?.h || todayRating?.h === "excellent" || todayRating?.h === "very-good" || todayWard?.memorization?.trim());
  const hasTodayRev = isTodayRecited && Boolean(todayState?.r || todayRating?.r === "excellent" || todayRating?.r === "very-good" || todayWard?.review?.trim());

  const todayMemPages = hasTodayMem ? pagesForWardDay(student, todayDayKey, "memorization").pages : 0;
  const todayRevPages = hasTodayRev ? pagesForWardDay(student, todayDayKey, "review").pages : 0;

  // البحث عن آخر يوم تسميع نشط في الأسبوع لإظهاره لولي الأمر في حال لم تبدأ جلسة اليوم بعد
  const latestActiveDay = useMemo(() => {
    for (let i = DAYS.length - 1; i >= 0; i--) {
      const dKey = DAYS[i].key;
      const st = student.days?.[dKey];
      const rt = student.recitationRatings?.[dKey];
      if (st?.a && !st.absent && (st.h || st.r || rt?.h || rt?.r)) {
        return {
          dayLabel: DAYS[i].label,
          dayKey: dKey,
          ward: student.ward?.[dKey],
          rating: rt,
          memPages: pagesForWardDay(student, dKey, "memorization").pages,
          revPages: pagesForWardDay(student, dKey, "review").pages,
        };
      }
    }
    return null;
  }, [student]);

  // إحصائيات الأسبوع الحالي
  const currPresent = DAYS.filter((d) => (student.days?.[d.key]?.a || (d.key === todayDayKey && isTodayRecited)) && !student.days?.[d.key]?.absent).length;
  const currAbsent = DAYS.filter((d) => student.days?.[d.key]?.absent === true || (d.key === todayDayKey && isTodayAbsent)).length;
  
  let currWeekMemPages = 0;
  let currWeekRevPages = 0;
  let currWeekExcellentCount = 0;
  let currWeekVeryGoodCount = 0;

  for (const d of DAYS) {
    const st = student.days?.[d.key];
    const rt = student.recitationRatings?.[d.key];
    const isDayRecited = (st?.a && !st.absent) || (d.key === todayDayKey && isTodayRecited);
    if (isDayRecited) {
      if (st?.h || rt?.h === "excellent" || rt?.h === "very-good" || student.ward?.[d.key]?.memorization?.trim()) {
        currWeekMemPages += pagesForWardDay(student, d.key, "memorization").pages;
        if (rt?.h === "very-good") currWeekVeryGoodCount++;
        else currWeekExcellentCount++;
      }
      if (st?.r || rt?.r === "excellent" || rt?.r === "very-good" || student.ward?.[d.key]?.review?.trim()) {
        currWeekRevPages += pagesForWardDay(student, d.key, "review").pages;
        if (rt?.r === "very-good") currWeekVeryGoodCount++;
        else currWeekExcellentCount++;
      }
    }
  }

  // حساب نسبة الانضباط الأسبوعية
  const totalTrackedDays = Math.max(1, currPresent + currAbsent);
  const disciplinePct = Math.min(100, Math.round((currPresent / totalTrackedDays) * 100));

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

  // حذف عنصر محدد عبر ID المستقل
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
    <div className="min-h-screen bg-[#f8f9fb] text-ink pb-24" dir="rtl">
      {/* 1. الشريط العلوي — ناعم، فخم، وخالٍ من الحدود السوداء أو الداكنة */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2.5 shadow-2xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl bg-gradient-to-tr from-grape-700 via-grape-600 to-indigo-500 text-white shadow-xs shrink-0">
              <Icon name="book" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xs sm:text-sm font-extrabold text-ink leading-tight truncate">
                نور الحفّاظ <span className="text-[10px] sm:text-xs font-bold text-grape-600 font-sans">| ولي الأمر</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate">متابعة الإنجاز والتحفيز المستمر</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-slate-600">
              {formatTeachingWeekRange(weekStartDateIso || localDateKey(teachingWeekStart()))}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-4">
        {/* 2. بطاقة الطالب العلوية (Hero Card) — مدمجة، فخمة، وبسطر إحصائيات ثلاثي متناسق */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
          {/* صف بيانات الطالب الأساسية (صورة مدمجة وخطوط رشيقة) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <Avatar photo={student.photo} name={student.name} size={46} frame={student.frame} crown={student.crown} glow={student.glow} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="font-display text-sm sm:text-lg font-extrabold text-ink truncate">
                  {student.name}
                </h2>
                <span className="rounded-full bg-gradient-to-r from-grape-600 to-indigo-600 px-2 py-0.5 font-display text-[10px] sm:text-xs font-extrabold text-white shadow-2xs shrink-0">
                  المستوى {ar(safeLevel)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-500">
                <span className="rounded-md bg-slate-50 border border-slate-100 px-1.5 py-0.5 truncate">
                  {halaqa?.name || "حلقة القرآن الكريم"}
                </span>
                <span className="rounded-md bg-emerald-50/80 border border-emerald-100 text-emerald-700 px-1.5 py-0.5 shrink-0 font-mono">
                  #{student.parentAccessToken?.slice(0, 6) || "مفعّل"}
                </span>
              </div>
            </div>
          </div>

          {/* سطر الإحصائيات الثلاثي في سطر واحد بنظام شبكي منظم (grid grid-cols-3 gap-2) وبأحجام متناسقة */}
          <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-100/80">
            <div className="rounded-xl border border-amber-100/80 bg-amber-50/30 p-1.5 sm:p-2 text-center shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-extrabold text-amber-700">العملات</span>
              <span className="flex items-center justify-center gap-1 font-display text-xs sm:text-base font-black text-amber-900 mt-0.5">
                <Coin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {ar(student.coins)}
              </span>
            </div>

            <div className="rounded-xl border border-purple-100/80 bg-purple-50/30 p-1.5 sm:p-2 text-center shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-extrabold text-purple-700">النقاط</span>
              <span className="flex items-center justify-center gap-1 font-display text-xs sm:text-base font-black text-purple-900 mt-0.5">
                <Icon name="bolt" fill className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600" />
                {ar(student.xp)}
              </span>
            </div>

            <div className="rounded-xl border border-rose-100/80 bg-rose-50/30 p-1.5 sm:p-2 text-center shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-extrabold text-rose-700">القلوب</span>
              <div className="mt-0.5 flex justify-center">
                <HeartsRow hearts={student.hearts} max={3} size="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
          </div>

          {/* شريط تقدم المستوى — محمي من الـ NaN */}
          <div className="mt-2.5 pt-2 border-t border-slate-100/60">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">
              <span>تقدم المستوى الحالي ({ar(safeLevel)})</span>
              <span className="font-extrabold text-slate-700">{ar(safeInto)} / {ar(safeNeed)} نقطة ({ar(safePct)}%)</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-grape-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${safePct}%` }}
              />
            </div>
          </div>
        </section>

        {/* 3. تنبيه الاختبار القادم (إذا كان مجدولاً للطالب) */}
        {student.isTesting && (
          <section className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-l from-amber-500/10 via-amber-50 to-white p-3 sm:p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500 text-white font-black text-sm shadow-xs">
                  📝
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-black">
                      اختبار قادم
                    </span>
                    <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink">
                      الطالب مرشح لاختبار مرحلي في الحلقة
                    </h3>
                  </div>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-slate-600 leading-relaxed">
                    يُرجى تشجيع الطالب على مراجعة السور المقررة والتسميع المسبق في المنزل لضمان الجاهزية والتميز.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. تبويبات التنقل الرئيسية — زوايا منحنية ناعمة (rounded-xl) وتبديل سلس */}
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
            <Icon name="gift" className="h-3.5 w-3.5" />
            <span>المشتريات ({ar(studentOrders.length)})</span>
          </button>
        </div>

        {/* 5. التبويب الأول: الحفظ والإنجاز (لوحة المتابعة اليومية وشبكة الإحصائيات) */}
        {activeTab === "progress" && (
          <div className="space-y-3 sm:space-y-4">
            {/* أ) أداء اليوم */}
            <section className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-purple-50 text-purple-700 text-xs">
                    📊
                  </span>
                  <div>
                    <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink">
                      أداء اليوم · {todayDateStr}
                    </h3>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400">متابعة الحضور والتسميع المنجز</p>
                  </div>
                </div>

                <div>
                  {isTodayAbsent ? (
                    <span className="rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] sm:text-xs font-black text-rose-700">
                      غائب اليوم ✕
                    </span>
                  ) : isTodayRecited ? (
                    <span className="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] sm:text-xs font-black text-emerald-800">
                      حاضر وتم التسميع ✓
                    </span>
                  ) : (
                    <span className="rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-slate-500">
                      بانتظار بدء الجلسة
                    </span>
                  )}
                </div>
              </div>

              {/* بطاقات الحفظ والمراجعة لليوم */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {/* ورد الحفظ */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-display text-[11px] sm:text-xs font-extrabold text-grape-800">
                      <Icon name="book" className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-grape-600" />
                      ورد الحفظ الجديد
                    </span>
                    {hasTodayMem ? (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white">
                        {todayRating?.h === "very-good" ? "جيد جدًا" : "ممتاز ✓"}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 border border-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold">
                        {isTodayRecited ? "تم اعتماده" : "قيد المتابعة"}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-xs sm:text-sm text-ink truncate">
                    {todayWard?.memorization?.trim() || latestActiveDay?.ward?.memorization?.trim() || "الورد المحدد قيد المتابعة"}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold text-slate-500 pt-1 border-t border-slate-200/50">
                    <span>{ar(todayWard?.memorizationVerses || latestActiveDay?.ward?.memorizationVerses || 0)} آية</span>
                    <span>&bull;</span>
                    <span>{ar(todayWard?.memorizationLines || latestActiveDay?.ward?.memorizationLines || 0)} سطر</span>
                    <span>&bull;</span>
                    <span className="text-grape-800 font-black">{n(todayMemPages || latestActiveDay?.memPages || 0)} صفحة</span>
                  </div>
                </div>

                {/* ورد المراجعة */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-display text-[11px] sm:text-xs font-extrabold text-amber-900">
                      <Icon name="refresh" className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600" />
                      ورد المراجعة اليومي
                    </span>
                    {hasTodayRev ? (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white">
                        {todayRating?.r === "very-good" ? "جيد جدًا" : "ممتاز ✓"}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 border border-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold">
                        {isTodayRecited ? "تم اعتماده" : "قيد المتابعة"}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-xs sm:text-sm text-ink truncate">
                    {todayWard?.review?.trim() || latestActiveDay?.ward?.review?.trim() || "الورد المحدد قيد المتابعة"}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold text-slate-500 pt-1 border-t border-slate-200/50">
                    <span>{ar(todayWard?.reviewVerses || latestActiveDay?.ward?.reviewVerses || 0)} آية</span>
                    <span>&bull;</span>
                    <span>{ar(todayWard?.reviewLines || latestActiveDay?.ward?.reviewLines || 0)} سطر</span>
                    <span>&bull;</span>
                    <span className="text-amber-900 font-black">{n(todayRevPages || latestActiveDay?.revPages || 0)} صفحة</span>
                  </div>
                </div>
              </div>

              {/* تنبيه ذكي عند عدم بدء جلسة اليوم يوضح آخر تسميع معتمد للطالب */}
              {!isTodayRecited && !isTodayAbsent && latestActiveDay && (
                <div className="rounded-xl bg-purple-50/50 border border-purple-100/60 p-2 sm:p-2.5 text-[10px] sm:text-[11px] font-bold text-purple-900 flex items-center justify-between gap-1.5">
                  <span className="truncate">📌 آخر تسميع معتمد: يوم ({latestActiveDay.dayLabel}) — ورد: {latestActiveDay.ward?.memorization || "الورد اليومي"} ({n(latestActiveDay.memPages)} ص)</span>
                  <span className="rounded bg-purple-200/60 px-1.5 py-0.5 text-[9px] font-black shrink-0">ممتاز ✓</span>
                </div>
              )}
            </section>

            {/* ب) شبكة الإحصائيات المدمجة بنظام كارتين في كل سطر (grid grid-cols-2 gap-3) على الجوال */}
            <section className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-50 text-amber-700 text-xs">
                    📈
                  </span>
                  <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink">
                    إحصائيات الإنجاز والتطور
                  </h3>
                </div>

                <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60 text-[10px] sm:text-xs">
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("today")}
                    className={`rounded-md px-2 py-0.5 font-extrabold transition ${
                      statsPeriod === "today" ? "bg-white text-grape-800 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("week")}
                    className={`rounded-md px-2 py-0.5 font-extrabold transition ${
                      statsPeriod === "week" ? "bg-white text-grape-800 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    هذا الأسبوع
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod("month")}
                    className={`rounded-md px-2 py-0.5 font-extrabold transition ${
                      statsPeriod === "month" ? "bg-white text-grape-800 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    الشهر
                  </button>
                </div>
              </div>

              {/* كروت الإحصائيات الأربعة: (حضور الأسبوع، نسبة الانضباط، صفحات الحفظ، صفحات المراجعة) */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 anim-fade">
                {/* 1. صفحات الحفظ */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-purple-50 text-purple-600">
                      <Icon name="book" className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold">
                      {statsPeriod === "today" ? "حفظ اليوم" : statsPeriod === "week" ? "حفظ الأسبوع" : "حفظ الشهر"}
                    </span>
                  </div>
                  <p className="font-display text-base sm:text-lg font-black text-ink">
                    {n(statsPeriod === "today" ? (todayMemPages || latestActiveDay?.memPages || 0) : statsPeriod === "week" ? currWeekMemPages : monthMemPages)} ص
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                    {statsPeriod === "today" ? `${ar(todayWard?.memorizationVerses || latestActiveDay?.ward?.memorizationVerses || 0)} آية` : statsPeriod === "week" ? "إنجاز تراكمي" : `شهر ${currentMonthName}`}
                  </p>
                </div>

                {/* 2. صفحات المراجعة */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-50 text-amber-600">
                      <Icon name="refresh" className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold">
                      {statsPeriod === "today" ? "مراجعة اليوم" : statsPeriod === "week" ? "مراجعة الأسبوع" : "مراجعة الشهر"}
                    </span>
                  </div>
                  <p className="font-display text-base sm:text-lg font-black text-ink">
                    {n(statsPeriod === "today" ? (todayRevPages || latestActiveDay?.revPages || 0) : statsPeriod === "week" ? currWeekRevPages : monthRevPages)} ص
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                    {statsPeriod === "today" ? `${ar(todayWard?.reviewVerses || latestActiveDay?.ward?.reviewVerses || 0)} آية` : statsPeriod === "week" ? "تثبيت وضبط" : "مجموع تراكمي"}
                  </p>
                </div>

                {/* 3. حضور الأسبوع */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold">
                      {statsPeriod === "today" ? "حضور اليوم" : statsPeriod === "week" ? "حضور الأسبوع" : "حضور الشهر"}
                    </span>
                  </div>
                  <p className="font-display text-base sm:text-lg font-black text-emerald-700">
                    {statsPeriod === "today" ? (isTodayAbsent ? "غياب ✕" : isTodayRecited ? "حاضر ✓" : "بانتظار الجلسة") : statsPeriod === "week" ? `${ar(currPresent)} / ٤ أيام` : `${ar(monthPresent)} يوم`}
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5">
                    {statsPeriod === "today" ? "تسجيل مباشر" : statsPeriod === "week" ? (currAbsent > 0 ? `${ar(currAbsent)} غياب` : "انضباط كامل ✓") : (monthAbsent > 0 ? `${ar(monthAbsent)} غياب` : "التزام شهري")}
                  </p>
                </div>

                {/* 4. نسبة الانضباط ومستوى الإتقان */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-50 text-sky-600">
                      <Icon name="award" className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold">نسبة الانضباط</span>
                  </div>
                  <p className="font-display text-base sm:text-lg font-black text-sky-800">
                    {ar(disciplinePct)}%
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 mt-0.5 truncate">
                    {currWeekExcellentCount >= currWeekVeryGoodCount ? "درجة إتقان: ممتاز" : "درجة إتقان: جيد جدًا"}
                  </p>
                </div>
              </div>
            </section>

            {/* ج) شريط الأيام الأربعة للأسبوع التعليمي (أحد - أربعاء) */}
            <section className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
              <h4 className="font-display text-[11px] sm:text-xs font-extrabold text-ink mb-2 flex items-center gap-1.5">
                <span>📅</span>
                <span>سجل الأيام الأسبوعي (الأحد إلى الأربعاء)</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DAYS.map((d, idx) => {
                  const dayState = student.days?.[d.key];
                  const dayRating = student.recitationRatings?.[d.key];
                  const dayDate = addCalendarDays(weekStartDateIso || localDateKey(teachingWeekStart()), idx);
                  const isPastOrToday = idx <= activeDayIndex;
                  const isDayAbsent = dayState?.absent === true || (d.key === todayDayKey && isTodayAbsent);
                  const isDayPresent = (dayState?.a === true || (d.key === todayDayKey && isTodayRecited)) && !isDayAbsent;
                  const hasDoneMem = isDayPresent && (dayState?.h || dayRating?.h === "excellent" || dayRating?.h === "very-good" || student.ward?.[d.key]?.memorization?.trim());
                  const hasDoneRev = isDayPresent && (dayState?.r || dayRating?.r === "excellent" || dayRating?.r === "very-good" || student.ward?.[d.key]?.review?.trim());

                  return (
                    <div
                      key={d.key}
                      className={`rounded-xl border p-2 flex flex-col justify-between transition ${
                        isDayAbsent
                          ? "border-rose-100 bg-rose-50/30"
                          : hasDoneMem && hasDoneRev
                          ? "border-emerald-100 bg-emerald-50/30"
                          : isDayPresent
                          ? "border-sky-100 bg-sky-50/30"
                          : isPastOrToday
                          ? "border-slate-100 bg-slate-50/40"
                          : "border-slate-50 bg-white opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-display text-[11px] font-black text-ink">{d.label}</span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {formatHijriDate(dayDate, { day: "numeric", month: "numeric" })}
                        </span>
                      </div>

                      <div className="space-y-0.5 text-[9px] sm:text-[10px] font-bold">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">حضور:</span>
                          <span className={isDayAbsent ? "text-rose-600 font-black" : isDayPresent ? "text-emerald-700 font-black" : "text-slate-400"}>
                            {isDayAbsent ? "غياب" : isDayPresent ? "حاضر ✓" : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">حفظ:</span>
                          <span className={hasDoneMem ? "text-emerald-700 font-black" : "text-slate-400"}>
                            {hasDoneMem ? "أنجز ✓" : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">مراجعة:</span>
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

            {/* د) نصائح وتوجيهات الذكاء الاصطناعي التربوية */}
            {guidance && (
              <section className="rounded-2xl border border-purple-50 bg-white p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-purple-50 text-purple-700 text-xs">
                      💡
                    </span>
                    <div>
                      <h3 className="font-display text-xs sm:text-sm font-extrabold text-ink">
                        نصائح وتوجيهات لتطوير الطالب
                      </h3>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400">تحليل مبني على السجلات ومبادئ الحفظ المعتمدة</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-black ${
                    guidance.overallStatus === "excellent" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                    guidance.overallStatus === "improving" ? "bg-sky-50 text-sky-800 border border-sky-100" :
                    guidance.overallStatus === "needs-attention" ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-purple-50 text-purple-800 border border-purple-100"
                  }`}>
                    {guidance.headline}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-2.5 sm:p-3 text-[11px] font-bold text-slate-600 leading-relaxed">
                  <p className="font-display font-extrabold text-xs mb-0.5 text-ink">ملخص الملاحظات التراكمية:</p>
                  {guidance.summary}
                </div>

                {/* كروت التوجيهات */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  {guidance.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3 flex flex-col justify-between space-y-1.5 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="rounded bg-white border border-slate-200/60 px-1.5 py-0.5 text-[9px] font-black text-slate-600">
                            {rec.badge}
                          </span>
                        </div>
                        <h4 className="font-display text-xs font-extrabold text-ink">
                          {rec.title}
                        </h4>
                        <p className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-slate-500 leading-relaxed">
                          {rec.body}
                        </p>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200/40 text-[9px] font-bold text-slate-400">
                        {rec.educationalPrinciple}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 6. التبويب الثاني: متجر الطالب — 2-Column Grid على الجوال، صور مدمجة (h-32 إلى h-36) وتنظيم أنيق */}
        {activeTab === "store" && (
          <div className="space-y-3 sm:space-y-4">
            {!parentStoreOpen ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 text-center shadow-sm">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 text-2xl mb-2">
                  🔒
                </span>
                <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">متجر الجوائز مغلق حاليًا</h3>
                <p className="mt-1 text-[11px] font-bold text-slate-500 max-w-sm mx-auto leading-relaxed">
                  يفتح المعلم المتجر في أوقات محددة لمكافأة الطلاب والشراء بعملاتهم المكتسبة من إنجاز الحفظ والمراجعة.
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
                    <h3 className="font-display text-xs sm:text-sm font-extrabold text-amber-950">متجر الجوائز والمكافآت</h3>
                    <p className="text-[10px] sm:text-[11px] font-bold text-amber-800">اشترِ لابنك الجوائز والهدايا باستخدام عملاته التي جمعها من الحفظ</p>
                  </div>
                  <div className="rounded-xl bg-white px-2.5 py-1 font-display text-xs sm:text-sm font-black text-amber-950 border border-amber-200/60 shadow-2xs">
                    الرصيد: {ar(student.coins)} 🪙
                  </div>
                </div>

                {/* شبكة المنتجات: عمودين تماماً على الجوال بحجم مربعات متوسطة ومريحة للعين */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
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
                            {locked ? `مقفل (م${ar(p.minLevel)})` : soldOut ? "مملوك مسبقًا" : outOfStock ? "نفدت الكمية" : poor ? "العملات لا تكفي" : "+ أضف للسلة"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* شريط السلة العائم */}
                {cart.length > 0 && (
                  <div className="fixed bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 max-w-4xl mx-auto z-40 rounded-2xl border border-purple-100 bg-white/95 backdrop-blur-md p-3 shadow-xl anim-slide-up">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xs sm:text-sm font-extrabold text-ink">سلة المشتريات ({ar(cart.length)})</span>
                          <span className="font-display text-xs font-black text-amber-950 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            المجموع: {ar(cartTotal)} 🪙
                          </span>
                        </div>
                        {/* كل منتج بزر حذف مستقل */}
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
                          {isSubmitting ? "جارٍ الشراء..." : "تأكيد الشراء ✓"}
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
          <div className="space-y-3 sm:space-y-3.5">
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
                  عند شراء منتج أو جائزة من المتجر، ستظهر هنا فورًا مع حالة تسليمها.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
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
                            تم التسليم ✓
                          </span>
                        ) : (
                          <span className="rounded-lg bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            قيد التسليم ⏳
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

      <footer className="text-center pt-6 text-[11px] font-bold text-slate-400">
        منصة نور الحفّاظ &bull; متابعة حصرية للطالب {student.name}
      </footer>
    </div>
  );
}
