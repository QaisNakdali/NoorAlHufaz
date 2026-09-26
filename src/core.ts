/* الأنواع والبيانات والمنطق الأساسي للمنصة */
import { currentHijriMonthBounds } from "./hijriDate";

/* ---------- أدوات ---------- */
export const ar = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ---------- الأنواع ---------- */
export type FrameKind = "silver" | "gold" | "rainbow" | "emerald" | "coral" | "sky" | "sunset";
export type GlowKind = "gold" | "purple" | "mint" | "coral";
/** خلفيات البطاقة بألوان واضحة يحبها الأطفال */
export type BgKind = "red" | "orange" | "yellow" | "green" | "sky" | "blue" | "purple" | "pink" | "night";
/** ترحيل قيم الخلفيات القديمة المحفوظة إلى الجديدة */
export const BG_MIGRATION: Record<string, BgKind> = {
  gold: "yellow",
  mint: "green",
  coral: "pink",
  purple: "purple",
  sky: "sky",
  night: "night",
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  blue: "blue",
  pink: "pink",
};
export type CrownKind = "gold" | "silver";

/** نوع العنصر في المتجر: خاصية بروفايل (تُلبس) أو جائزة خارجية (تُستلم) */
export type ItemKind = "cosmetic" | "external";
/** خانة الخاصية — كل خانة تُلبس عنصرًا واحدًا في الوقت نفسه */
export type CosmeticSlot = "frame" | "crown" | "glow" | "cardbg";

export type AwardRec = { id: string; title: string; week: number; coins?: number };
export type HalaqaTeacher = { id: string; name: string; createdAt: number };
/**
 * إعدادات الحلقة متزامنة ضمن app_state. الحقول الجديدة اختيارية لتبقى كل
 * الحلقات القديمة صالحة، ويقوم التطبيع بإكمالها دون تغيير الطلاب.
 */
export type Halaqa = {
  id: string;
  name: string;
  createdAt: number;
  teachers?: HalaqaTeacher[];
  randomDistribution?: boolean;
  rotationAnchorDate?: string;
  rotationSeed?: number;
};
/** درس محفوظ مستقل عن بيانات الطلاب، ويحافظ order على تسلسل الإضافة. */
export type Lesson = {
  id: string;
  title: string;
  teacher: string;
  order: number;
  createdAt: number;
  completedAt: number | null;
};
export type RewardKey = "champions" | "improved" | "behavior" | "trip";
export type ChampionRatingMode = "excellent" | "mixed";
export type RewardOption = { enabled: boolean; coins: number; ratingMode?: ChampionRatingMode };
export type RewardSettings = Record<RewardKey, RewardOption>;
export type RewardGrant = {
  id: string;
  week: number;
  studentId: string;
  studentName: string;
  reward: RewardKey;
  title: string;
  coins: number;
  grantedAt: number;
};

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  // mixed يحافظ على السلوك السابق للبيانات القديمة، ويقبل ممتاز/جيد جدًا معًا.
  champions: { enabled: true, coins: 0, ratingMode: "mixed" },
  improved: { enabled: true, coins: 0 },
  behavior: { enabled: true, coins: 0 },
  trip: { enabled: false, coins: 0 },
};

/** مشتريات خارجية في الحقيبة — الكمية + ما سُلم منها */
export type BagEntry = { itemId: string; qty: number; receivedQty: number };

export type DayKey = "sun" | "mon" | "tue" | "wed";
export type DayPart = "a" | "h" | "r"; // حضور | تسميع حفظ | تسميع مراجعة
export type RecitationPart = "h" | "r";
export type RecitationRating = "excellent" | "very-good";
/** absent حالة مستقلة اختيارية؛ غيابها في البيانات القديمة يعني أن اليوم غير محدد، لا أنه غياب. */
export type DayEntry = Record<DayPart, boolean> & { absent?: boolean };
export type WeekDays = Record<DayKey, DayEntry>;
export type RecitationRatings = Record<DayKey, Partial<Record<RecitationPart, RecitationRating>>>;

/** الورد ثابت بين الأسابيع، بينما حالة إنجازه موجودة في days وتُصفّر أسبوعيًا. */
export type WardUnit = "lines" | "pages";
export type DailyWard = {
  memorization: string;
  review: string;
  memorizationVerses: number;
  reviewVerses: number;
  memorizationLines: number;
  reviewLines: number;
  memorizationFromVerse?: number;
  memorizationToVerse?: number;
  reviewFromVerse?: number;
  reviewToVerse?: number;
};
export type WeeklyWard = Record<DayKey, DailyWard>;

export type LastHeardEntry = { text: string; verses: number; lines?: number; day: string; at: number };
export type LastHeard = { memorization?: LastHeardEntry; review?: LastHeardEntry };

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "sun", label: "الأحد" },
  { key: "mon", label: "الاثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
];

export const DAY_PARTS: { key: DayPart; label: string; icon: string; xp: number; coins: number }[] = [
  { key: "a", label: "حضور", icon: "user", xp: 5, coins: 2 },
  { key: "h", label: "حفظ", icon: "book", xp: 10, coins: 5 },
  { key: "r", label: "مراجعة", icon: "refresh", xp: 10, coins: 5 },
];

export const ATTEND_XP = 5;
export const ATTEND_COINS = 2;
export const RECITE_XP = 10;
export const RECITE_COINS = 5;

export function emptyWeekDays(): WeekDays {
  const mk = (): DayEntry => ({ a: false, h: false, r: false, absent: false });
  return { sun: mk(), mon: mk(), tue: mk(), wed: mk() };
}

export function emptyRecitationRatings(): RecitationRatings {
  return { sun: {}, mon: {}, tue: {}, wed: {} };
}

export function emptyWeeklyWard(): WeeklyWard {
  const mk = (): DailyWard => ({ memorization: "", review: "", memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0 });
  return { sun: mk(), mon: mk(), tue: mk(), wed: mk() };
}

/** تقدير موحّد على أساس مصحف المدينة (15 سطرًا في الصفحة). */
export const estimatedLinesFromVerses = (verses: number): number =>
  Math.max(0, Math.round((Number(verses) || 0) * 1.45));

/** نقاط الأسبوع = مجموع نقاط كل الخانات المسجلة */
export function weekXpOf(days: WeekDays): number {
  let total = 0;
  for (const d of DAYS) {
    const e = days[d.key];
    if (e.a) total += ATTEND_XP;
    if (e.h) total += RECITE_XP;
    if (e.r) total += RECITE_XP;
  }
  return total;
}

/** عملات الأسبوع = مجموع عملات كل الخانات المسجلة */
export function weekCoinsOf(days: WeekDays): number {
  let total = 0;
  for (const d of DAYS) {
    const e = days[d.key];
    if (e.a) total += ATTEND_COINS;
    if (e.h) total += RECITE_COINS;
    if (e.r) total += RECITE_COINS;
  }
  return total;
}

/* ========== أنواع سجل الحفظ التفصيلي ========== */
/** سجل حفظ تفصيلي لكل جلسة تسميع */
export type MemorizationRecord = {
  id: string;
  studentId: string;
  surahName: string;        // اسم السورة
  fromVerse: number;        // من الآية
  toVerse: number;          // إلى الآية
  versesCount: number;      // عدد الآيات المحفوظة (toVerse - fromVerse + 1)
  date: string;             // ISO date string
  dayKey: DayKey;           // اليوم الذي تم فيه الحفظ
  success: boolean;         // هل أتم التسميع بنجاح
  notes?: string;           // ملاحظات اختيارية
  createdAt: number;        // timestamp للإضافة
};

export type Student = {
  id: string;
  name: string;
  photo: string | null;
  /** حلقة واحدة فقط. null يحافظ على الطلاب القدامى بلا تعيين إجباري. */
  halaqaId?: string | null;
  hearts: number;
  heartsLostWeek: number;
  xp: number;
  weekXp: number; // نقاط هذا الأسبوع من الكشف
  weekCoins: number; // عملات هذا الأسبوع من الكشف
  coins: number;
  isTesting?: boolean;
  createdAt?: number;
  days: WeekDays;
  /** وصف جودة التسميع فقط؛ المكافأة تظل مرتبطة بقيمة days المنجزة. */
  recitationRatings?: RecitationRatings;
  ward: WeeklyWard; // الخطة اليومية؛ لا تتصفّر عند بدء أسبوع جديد
  lastHeard?: LastHeard; // آخر حفظ ومراجعة سمعهما الطالب؛ لا يتصفّران أسبوعيًا
  inventory: string[]; // ids خصائص البروفايل المملوكة
  bag: BagEntry[]; // المشتريات الخارجية
  frame?: FrameKind | null;
  crown?: CrownKind | null;
  glow?: GlowKind | null;
  cardBg?: BgKind | null;
  awards: AwardRec[];
  /** أعلى مستوى استلم الطالب مكافأته بالفعل لمنع تكرار مكافأة المستوى */
  highestRewardedLevel?: number;
  memorizationRecords?: MemorizationRecord[]; // سجل الحفظ التفصيلي (جديد)
};

export type ShopItem = {
  id: string;
  name: string;
  desc: string;
  price: number;
  minLevel: number;
  icon: string;
  image?: string | null;
  kind: ItemKind;
  repeatable?: boolean; // للخارجية: قابلة للتكرار دائمًا
  slot?: CosmeticSlot; // لخاصية البروفايل
  value?: string; // قيمة الخاصية (لون الإطار/التوهّج/الخلفية)
  addedWeek?: number; // الأسبوع الذي أُضيف فيه المنتج
  /** الأسبوع الذي عُرض فيه المنتج رسميًا في الحفل؛ غيابه يعني أنه ما زال متاحًا للعرض. */
  shownInCeremonyWeek?: number;
  /** علامة للمنتجات المضافة بعد تفعيل الانتقاء؛ تسمح بترحيل غير المحدد لأسابيع لاحقة. */
  ceremonyPending?: boolean;
  /** خيار التحكم في ظهور المنتج في الحفل الأسبوعي */
  showInCeremony?: boolean;
  stock?: number | null; // الكمية المتوفرة لدى المعلم (null = غير محدودة) — للنوعين
};

/** اسم بديل للتوافق */
export type ShopProduct = ShopItem;

/** كمية عنصر خارجي في حقيبة الطالب */
export const bagQty = (s: Student, itemId: string): number =>
  s.bag?.find((b) => b.itemId === itemId)?.qty ?? 0;
/** ما استلمه الطالب من هذا العنصر */
export const bagReceivedQty = (s: Student, itemId: string): number =>
  s.bag?.find((b) => b.itemId === itemId)?.receivedQty ?? 0;
/** مجموع الوحدات بانتظار التسليم في حقيبة الطالب */
export const bagPendingUnits = (s: Student): number =>
  (s.bag ?? []).reduce((n, b) => n + Math.max(0, b.qty - b.receivedQty), 0);

/* ---------- المستويات ---------- */
export const MAX_LEVEL = 10;
export const LEVEL_COIN_REWARD = 5;

export const xpNeed = (level: number): number => 90 + (level - 1) * 10;

/** مجموع الخبرة اللازم للوصول إلى مستوى معيّن */
export const xpForLevel = (target: number): number => {
  let s = 0;
  for (let l = 1; l < target; l++) s += xpNeed(l);
  return s;
};

export function levelInfo(xp: number): { level: number; into: number; need: number; maxed: boolean; legend: number } {
  let level = 1;
  let rest = Math.max(0, xp);
  // بلا سقف: بعد المستوى العاشر يبدأ المسار الأسطوري (نجوم لا تنتهي)
  while (rest >= xpNeed(level)) {
    rest -= xpNeed(level);
    level++;
  }
  const legend = Math.max(0, level - MAX_LEVEL);
  return { level, into: rest, need: xpNeed(level), maxed: false, legend };
}

/** ترتيب كثيف حسب النقاط الحالية: المتساوون في النقاط يأخذون المركز نفسه دون أرقام مفقودة. */
export function denseXpRanking(students: Student[]): { student: Student; rank: number }[] {
  const ordered = [...students].sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, "ar"));
  let rank = 0;
  let previousXp: number | null = null;
  return ordered.map((student) => {
    if (previousXp === null || student.xp !== previousXp) rank += 1;
    previousXp = student.xp;
    return { student, rank };
  });
}

export function denseWeekRanking(students: Student[]): { student: Student; rank: number }[] {
  const ordered = [...students].sort((a, b) => b.weekXp - a.weekXp || a.name.localeCompare(b.name, "ar"));
  let rank = 0;
  let previousPoints: number | null = null;
  return ordered.map((student) => {
    if (previousPoints === null || student.weekXp !== previousPoints) rank += 1;
    previousPoints = student.weekXp;
    return { student, rank };
  });
}

export const TITLES = ["براعم النور", "قارئ ماهر", "نجم الحفظ", "فارس الحفظ", "تاج الحفاظ"];
export const LEGEND_TITLE = "أسطورة الحفاظ";

export const rankOf = (level: number): string => {
  if (level > MAX_LEVEL) return LEGEND_TITLE;
  return TITLES[Math.min(Math.floor((level - 1) / 2), TITLES.length - 1)];
};

/** يضيف خبرة ويعيد الطالب المحدّث مع مستوى الترقية إن حصلت */
export function applyXp(s: Student, amount: number): { student: Student; leveled: number | null } {
  const before = levelInfo(s.xp).level;
  const student = { ...s, xp: Math.max(0, s.xp + amount) };
  const after = levelInfo(student.xp).level;
  return { student, leveled: after > before ? after : null };
}

/* ---------- المتجر ----------
   موازنة الأسعار مع دخل التسميع (~٤٨ عملة في الأسبوع الكامل):
   - خصائص البروفايل: ١٨+ خاصية بأسعار ٢٠–١٠٠، يمكن جعلها نادرة ومحدودة
   - الجوائز الخارجية: كلها قابلة للتكرار بكميات يحددها المعلم
   كل مستوى يفتح عناصر جديدة قابلة للشراء. */
export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  // ===== المستوى ١ =====
  { id: "stickers", name: "ملصقات النجوم", desc: "ملصقات لامعة تزيّن بها دفترك", price: 15, minLevel: 1, icon: "star", kind: "external", repeatable: true },
  { id: "bg-yellow", name: "خلفية صفراء", desc: "لوّن بطاقة بروفايلك بالأصفر المشرق كالشمس", price: 20, minLevel: 1, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "yellow" },
  // ===== المستوى ٢ =====
  { id: "pencil", name: "قلم فسفوري", desc: "قلم مميّز لكتابة الورد اليومي", price: 20, minLevel: 2, icon: "pencil", kind: "external", repeatable: true },
  { id: "juice", name: "عصير", desc: "عصير لذيذ وقت الاستراحة", price: 20, minLevel: 2, icon: "gift", kind: "external", repeatable: true },
  { id: "bg-green", name: "خلفية خضراء", desc: "لوّن بطاقتك بالأخضر الجميل كالربيع", price: 20, minLevel: 2, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "green" },
  { id: "frame-silver", name: "إطار فضّي", desc: "إطار يلمع حول صورتك في المنصة", price: 30, minLevel: 2, icon: "frame", kind: "cosmetic", slot: "frame", value: "silver" },
  // ===== المستوى ٣ =====
  { id: "icecream", name: "آيس كريم", desc: "آيس كريم بارد مكافأة لاجتهادك", price: 25, minLevel: 3, icon: "gift", kind: "external", repeatable: true },
  { id: "bg-sky", name: "خلفية سماوية", desc: "لوّن بطاقتك بأزرق السماء الصافي", price: 25, minLevel: 3, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "sky" },
  { id: "badge", name: "شارة نجم الأسبوع", desc: "شارة تلبسها أمام أصحابك بفخر", price: 30, minLevel: 3, icon: "badge", kind: "external", repeatable: true },
  { id: "frame-sky", name: "إطار سماوي", desc: "إطار أزرق صافٍ كسماء الصيف", price: 35, minLevel: 3, icon: "frame", kind: "cosmetic", slot: "frame", value: "sky" },
  { id: "glow-mint", name: "توهّج نعناعي", desc: "هالة خضراء تتوهج حول صورتك", price: 35, minLevel: 3, icon: "sparkle", kind: "cosmetic", slot: "glow", value: "mint" },
  // ===== المستوى ٤ =====
  { id: "chocolate", name: "لوح شوكولاتة", desc: "لوح شوكولاتة لذيذ", price: 30, minLevel: 4, icon: "gift", kind: "external", repeatable: true },
  { id: "bg-blue", name: "خلفية زرقاء", desc: "لوّن بطاقتك بالأزرق الجميل كالمحيط", price: 25, minLevel: 4, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "blue" },
  { id: "frame-emerald", name: "إطار زمردي", desc: "إطار أخضر فاخر كحجر الزمرد", price: 40, minLevel: 4, icon: "frame", kind: "cosmetic", slot: "frame", value: "emerald" },
  { id: "glow-gold", name: "توهّج ذهبي", desc: "هالة ذهبية ملوكية حول صورتك", price: 45, minLevel: 4, icon: "sparkle", kind: "cosmetic", slot: "glow", value: "gold" },
  { id: "puzzle", name: "لعبة مكعّب", desc: "لعبة تركيب ممتعة وقت الاستراحة", price: 45, minLevel: 4, icon: "puzzle", kind: "external", repeatable: true },
  // ===== المستوى ٥ =====
  { id: "balloon", name: "بالونات ملوّنة", desc: "باقة بالونات تحتفل بها", price: 35, minLevel: 5, icon: "gift", kind: "external", repeatable: true },
  { id: "bg-pink", name: "خلفية وردية", desc: "لوّن بطاقتك بالوردي الجميل والحالم", price: 25, minLevel: 5, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "pink" },
  { id: "stories", name: "قصص الأنبياء", desc: "كتاب قصص ملوّن وجميل", price: 55, minLevel: 5, icon: "book", kind: "external", repeatable: true },
  // ===== المستوى ٦ =====
  { id: "toy", name: "لعبة صغيرة", desc: "لعبة ممتعة تختارها بنفسك", price: 50, minLevel: 6, icon: "puzzle", kind: "external", repeatable: true },
  { id: "bg-orange", name: "خلفية برتقالية", desc: "لوّن بطاقتك بالبرتقالي الدافئ والمبهج", price: 30, minLevel: 6, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "orange" },
  { id: "frame-coral", name: "إطار مرجاني", desc: "إطار وردي دافئ كألوان المرجان", price: 50, minLevel: 6, icon: "frame", kind: "cosmetic", slot: "frame", value: "coral" },
  { id: "glow-purple", name: "توهّج بنفسجي", desc: "هالة بنفسجية ساحرة حول صورتك", price: 55, minLevel: 6, icon: "sparkle", kind: "cosmetic", slot: "glow", value: "purple" },
  // ===== المستوى ٧ =====
  { id: "frame-gold", name: "إطار ذهبي", desc: "إطار الأبطال اللامع", price: 60, minLevel: 7, icon: "frame", kind: "cosmetic", slot: "frame", value: "gold" },
  { id: "glow-coral", name: "توهّج مرجاني", desc: "هالة وردية دافئة حول صورتك", price: 60, minLevel: 7, icon: "sparkle", kind: "cosmetic", slot: "glow", value: "coral" },
  { id: "bg-purple", name: "خلفية بنفسجية", desc: "لوّن بطاقتك بالبنفسجي الملكي الفاخر", price: 30, minLevel: 7, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "purple" },
  { id: "movie", name: "ليلة فيلم", desc: "تختار فيلمًا تعليميًا ونشاهده مع الحلقة", price: 65, minLevel: 7, icon: "play", kind: "external", repeatable: true },
  { id: "gamenight", name: "جلسة ألعاب جماعية", desc: "نلعب مع الفصل كله حصة كاملة!", price: 90, minLevel: 7, icon: "dice", kind: "external", repeatable: true },
  // ===== المستوى ٨ =====
  { id: "bg-red", name: "خلفية حمراء", desc: "لوّن بطاقتك بالأحمر القوي والحيوي", price: 30, minLevel: 8, icon: "frame", kind: "cosmetic", slot: "cardbg", value: "red" },
  { id: "crown-silver", name: "تاج فضّي", desc: "تاج فضّي أنيق فوق صورتك", price: 55, minLevel: 8, icon: "crown", kind: "cosmetic", slot: "crown", value: "silver" },
  { id: "crown", name: "تاج البطل الذهبي", desc: "تاج ذهبي يظهر فوق صورتك", price: 70, minLevel: 8, icon: "crown", kind: "cosmetic", slot: "crown", value: "gold" },
  { id: "picnic", name: "نزهة في الحديقة", desc: "رحلة ممتعة إلى الحديقة مع أصدقائك", price: 80, minLevel: 8, icon: "flag", kind: "external", repeatable: true },
  { id: "frame-sunset", name: "إطار الغروب", desc: "إطار برتقالي مشتعِل كألوان الغروب", price: 85, minLevel: 8, icon: "frame", kind: "cosmetic", slot: "frame", value: "sunset" },
  // ===== المستوى ٩ =====
  { id: "bottle", name: "قارورة ماء مميّزة", desc: "قارورة جميلة تحملها معك للحلقة", price: 80, minLevel: 9, icon: "gift", kind: "external", repeatable: true },
  { id: "grand", name: "الجائزة الكبرى", desc: "حفلة بيتزا مع كل أصدقاء الحلقة", price: 150, minLevel: 9, icon: "gift", kind: "external", repeatable: true },
  // ===== المستوى ١٠ =====
  { id: "bg-night", name: "خلفية الليل", desc: "بطاقة داكنة بنجوم متلألئة — الأكثر تميزًا", price: 90, minLevel: 10, icon: "moon", kind: "cosmetic", slot: "cardbg", value: "night" },
  { id: "frame-rainbow", name: "إطار قوس قزح", desc: "أندر إطار في المتجر كله", price: 100, minLevel: 10, icon: "rainbow", kind: "cosmetic", slot: "frame", value: "rainbow" },
];

export const findItem = (items: ShopItem[], id: string): ShopItem | undefined =>
  items.find((i) => i.id === id);

/** يطبق خاصية البروفايل على الطالب */
export function equipOn(s: Student, item: ShopItem): Student {
  const v = item.value ?? "";
  if (item.slot === "frame") return { ...s, frame: v as FrameKind };
  if (item.slot === "crown") return { ...s, crown: v as CrownKind };
  if (item.slot === "glow") return { ...s, glow: v as GlowKind };
  if (item.slot === "cardbg") return { ...s, cardBg: v ? BG_MIGRATION[v] ?? (v as BgKind) : null };
  return s;
}

export const isEquipped = (s: Student, item: ShopItem): boolean => {
  if (item.slot === "frame") return s.frame === item.value;
  if (item.slot === "crown") return s.crown === item.value;
  if (item.slot === "glow") return s.glow === item.value;
  if (item.slot === "cardbg") return s.cardBg === item.value;
  return false;
};

/* ---------- الجوائز الأسبوعية ---------- */
export type CeremonyPicks = {
  /** حقول قديمة محفوظة للتوافق مع الأسابيع التي سبقت نظام الحلقات. */
  improved?: string;
  behavior?: string;
  /** فائز واحد من كل حلقة؛ المفتاح هو halaqaId والقيمة هي studentId. */
  improvedByHalaqa?: Record<string, string>;
  behaviorByHalaqa?: Record<string, string>;
  /** استثناءات أبطال الأسبوع لهذا الحفل فقط، دون تغيير بيانات الطالب أو إنجازه. */
  championExcludedIds?: string[];
  champion1?: string;
  champion2?: string;
  champion3?: string;
};

export type PerHalaqaRewardKey = "improved" | "behavior";

export const AWARDS_META: {
  key: keyof CeremonyPicks;
  title: string;
  desc: string;
  icon: string;
}[] = [
  { key: "behavior", title: "جائزة أفضل سلوك", desc: "قدوة في أدب الحلقة — بلا قلوب مفقودة", icon: "heart" },
  {
    key: "improved",
    title: "جائزة الأكثر تطوّرًا",
    desc: "اجتهد أكثر من ورده — الأكثر تسميعًا للحفظ والمراجعة",
    icon: "trend",
  },
];

/** عدد أيام الحضور هذا الأسبوع */
export const attendedDays = (s: Student): number => DAYS.filter((d) => s.days[d.key].a).length;
/** عدد خانات التسميع (حفظ + مراجعة) هذا الأسبوع */
export const recitations = (s: Student): number =>
  DAYS.reduce((n, d) => n + (s.days[d.key].h ? 1 : 0) + (s.days[d.key].r ? 1 : 0), 0);

/** استحقاق البطولة: أسبوع مكتمل (حضور كل الأيام + تسميع حفظ ومراجعة كل الأيام + الرحلة إن فُعّلت) */
export const isChampionEligible = (
  s: Student,
  tripOn: boolean,
  tripAttendees: string[],
  ratingMode: ChampionRatingMode = "mixed"
): boolean => {
  // 1. حضور جميع الأيام الأربعة (الأحد، الاثنين، الثلاثاء، الأربعاء) دون غياب
  const completedAttendance = DAYS.every((day) => s.days[day.key]?.a && !s.days[day.key]?.absent);

  // 2. إتمام تسميع الحفظ والمراجعة لجميع الأيام الأربعة (8 خانات تسميع كاملة)
  const completedRecitation = DAYS.every((day) => s.days[day.key]?.h && s.days[day.key]?.r);

  // 3. درجات التسميع:
  // إذا سُمّع التسميع ولم تُسجل درجة صريحة فالافتراضي هو "ممتاز"
  const getRating = (dayKey: DayKey, part: RecitationPart): RecitationRating => {
    return s.recitationRatings?.[dayKey]?.[part] ?? "excellent";
  };

  const ratingEligible = DAYS.every((day) => {
    const hRating = getRating(day.key, "h");
    const rRating = getRating(day.key, "r");
    if (ratingMode === "excellent") {
      return hRating === "excellent" && rRating === "excellent";
    }
    // وضع "مختلط": كل من ممتاز وجيد جدًا مسموح به لكل يوم
    return (
      (hRating === "excellent" || hRating === "very-good") &&
      (rRating === "excellent" || rRating === "very-good")
    );
  });

  // 4. الحفاظ على جميع القلوب (لم يخسر أي قلب خلال الأسبوع)
  const keptAllHearts = (s.heartsLostWeek ?? 0) === 0;

  // 5. الرحلة إن وُجدت
  const tripEligible = !tripOn || tripAttendees.includes(s.id);

  return completedAttendance && completedRecitation && ratingEligible && keptAllHearts && tripEligible;
};

/** شروط البطولة (للعرض) */
export const championCriteria = (tripOn: boolean, ratingMode: ChampionRatingMode = "mixed"): { icon: string; label: string; active: boolean }[] => [
  { icon: "calendar", label: "حضر كل الأيام بلا غياب", active: true },
  { icon: "book", label: "سمّع الحفظ والمراجعة كل الأيام", active: true },
  { icon: "star", label: ratingMode === "excellent" ? "كل الدرجات ممتاز" : "الدرجات ممتاز أو جيد جدًا", active: true },
  { icon: "heart", label: "لم يخسر أي قلب خلال الأسبوع", active: true },
  { icon: "flag", label: tripOn ? "حضر الرحلة" : "الرحلة إن وُجدت", active: tripOn },
];

/** جميع المؤهلين أبطال بالدرجة نفسها؛ لا ترتيب ولا مفاضلة بينهم. */
export function championTop(students: Student[], tripOn: boolean, tripAttendees: string[], ratingMode: ChampionRatingMode = "mixed"): Student[] {
  return students.filter((s) => isChampionEligible(s, tripOn, tripAttendees, ratingMode));
}

/* ---------- الرحلة الأسبوعية ---------- */
export type TripDay = "thu" | "fri" | "sat";
export const TRIP_DAYS: { key: TripDay; label: string }[] = [
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
];

/* ---------- القلوب ---------- */
export const MAX_HEARTS = 3;
/** السعر الابتدائي للبيانات القديمة فقط؛ الشراء يستخدم إعداد الحالة المتزامن. */
export const DEFAULT_HEART_PRICE = 40;

/* ---------- أرشيف الأسابيع ---------- */
export type WeekLogEntry = {
  id: string;
  name: string;
  photo: string | null;
  xp: number;
  weekXp: number;
  level: number;
  coins: number;
  hearts: number;
  frame: FrameKind | null;
  crown: CrownKind | null;
  attendanceDays?: number;
  absenceDays?: number;
  evaluatedDays?: number;
  memorizationLines?: number;
  reviewLines?: number;
  memorizationVerses?: number;
  reviewVerses?: number;
  memorizationPages?: number;
  reviewPages?: number;
  /** مؤشرات تحليلية اختيارية؛ غيابها في الأرشيف القديم لا يغيّر السجل. */
  memorizationDays?: number;
  reviewDays?: number;
  memorizationExpectedDays?: number;
  reviewExpectedDays?: number;
  memorizationExpectedPages?: number;
  reviewExpectedPages?: number;
  memorizationExcellent?: number;
  memorizationVeryGood?: number;
  reviewExcellent?: number;
  reviewVeryGood?: number;
  isTesting?: boolean;
  halaqaId?: string | null;
};

export type WeekStudentRecord = {
  id: string; name: string; photo: string | null; halaqaId?: string | null; isTesting?: boolean;
  days: WeekDays; recitationRatings: RecitationRatings; ward: WeeklyWard;
  hearts: number; heartsLostWeek: number; xp: number; coins: number;
};

export type WeekLog = {
  week: number;
  name: string;
  savedAt: string;
  /** تاريخ قابل للحساب للإحصائيات الجديدة؛ السجلات القديمة تبقى كما هي. */
  savedAtIso?: string;
  /** بداية أسبوع الكشف (الأحد) كمفتاح تقني؛ العرض للمستخدم هجري دائمًا. */
  weekStartDateIso?: string;
  top: WeekLogEntry[];
  /** لقطة آمنة لكل الطلاب من هذا الأسبوع؛ top يبقى للتوافق مع الأرشيف القديم. */
  students?: WeekLogEntry[];
  awards: { title: string; studentName: string; coins?: number; reward?: RewardKey }[];
  trip?: { day: TripDay; attendeeNames: string[] } | null;
  records?: WeekStudentRecord[];
  ceremonyPicks?: CeremonyPicks;
  rewardSettings?: RewardSettings;
  tripAttendeeIds?: string[];
};

/* ---------- الواجهات ---------- */
export type Tab = "register" | "lessons" | "store" | "deliveries" | "board" | "ceremony" | "past" | "term" | "stats";
export type Mode = "teacher" | "student";

/* ========== دوال مساعدة لسجل الحفظ والتحليلات ========== */

/** الحصول على آخر سجل حفظ للطالب */
export const getLastMemorizationRecord = (s: Student): MemorizationRecord | null => {
  const records = s.memorizationRecords ?? [];
  if (records.length === 0) return null;
  return [...records].sort((a, b) => b.createdAt - a.createdAt)[0];
};

/** ملخص مستوى الحفظ الحالي للطالب */
export const getMemorizationSummary = (s: Student): string => {
  const last = getLastMemorizationRecord(s);
  if (!last) return "";
  return `${last.surahName} ${ar(last.fromVerse)}-${ar(last.toVerse)}`;
};

/** حساب إجمالي الآيات المحفوظة من السجلات */
export const getTotalVersesMemorized = (s: Student): number => {
  const records = s.memorizationRecords ?? [];
  return records.reduce((sum, r) => sum + r.versesCount, 0);
};

/** حساب عدد جلسات الحفظ الناجحة */
export const getSuccessfulSessionsCount = (s: Student): number => {
  const records = s.memorizationRecords ?? [];
  return records.filter(r => r.success).length;
};

/** تحليل أداء الطالب خلال فترة زمنية */
export type PeriodAnalysis = {
  totalVerses: number;
  sessionsCount: number;
  successfulSessions: number;
  failedSessions: number;
  successRate: number; // نسبة النجاح
  averageVersesPerSession: number; // متوسط الآيات في الجلسة
  activeDays: number; // عدد الأيام التي كان فيها حفظ
  bestDay: { date: string; verses: number } | null; // أفضل يوم
  trend: "improving" | "stable" | "declining" | "insufficient-data"; // الاتجاه
};

/** تحليل حفظ الطالب خلال فترة معينة */
export function analyzeMemorizationPeriod(
  records: MemorizationRecord[],
  startDate: Date,
  endDate: Date
): PeriodAnalysis {
  const filtered = records.filter(r => {
    const d = new Date(r.date);
    return d >= startDate && d <= endDate;
  });

  if (filtered.length === 0) {
    return {
      totalVerses: 0,
      sessionsCount: 0,
      successfulSessions: 0,
      failedSessions: 0,
      successRate: 0,
      averageVersesPerSession: 0,
      activeDays: 0,
      bestDay: null,
      trend: "insufficient-data",
    };
  }

  const totalVerses = filtered.reduce((sum, r) => sum + r.versesCount, 0);
  const successfulSessions = filtered.filter(r => r.success).length;
  const failedSessions = filtered.filter(r => !r.success).length;
  const successRate = filtered.length > 0 ? (successfulSessions / filtered.length) * 100 : 0;
  const averageVersesPerSession = filtered.length > 0 ? totalVerses / filtered.length : 0;

  // تجميع حسب التاريخ
  const byDate: Record<string, number> = {};
  filtered.forEach(r => {
    const day = r.date.split("T")[0];
    byDate[day] = (byDate[day] ?? 0) + r.versesCount;
  });

  const activeDays = Object.keys(byDate).length;
  let bestDay: { date: string; verses: number } | null = null;
  for (const [date, verses] of Object.entries(byDate)) {
    if (!bestDay || verses > bestDay.verses) {
      bestDay = { date, verses };
    }
  }

  // حساب الاتجاه بمقارنة النصف الأول بالنصف الثاني من الفترة
  let trend: PeriodAnalysis["trend"] = "insufficient-data";
  if (filtered.length >= 4) {
    const sorted = [...filtered].sort((a, b) => a.createdAt - b.createdAt);
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const firstAvg = firstHalf.reduce((s, r) => s + r.versesCount, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.versesCount, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    const threshold = firstAvg * 0.2; // 20% تغيير

    if (diff > threshold) trend = "improving";
    else if (diff < -threshold) trend = "declining";
    else trend = "stable";
  }

  return {
    totalVerses,
    sessionsCount: filtered.length,
    successfulSessions,
    failedSessions,
    successRate,
    averageVersesPerSession,
    activeDays,
    bestDay,
    trend,
  };
}

/** تحليل الأسبوع الحالي */
export function analyzeCurrentWeek(records: MemorizationRecord[]): PeriodAnalysis {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return analyzeMemorizationPeriod(records, startOfWeek, endOfWeek);
}

/** تحليل الشهر الحالي */
export function analyzeCurrentMonth(records: MemorizationRecord[]): PeriodAnalysis {
  const { start, end } = currentHijriMonthBounds();
  return analyzeMemorizationPeriod(records, start, end);
}

/** مقارنة بين أسبوعين */
export function compareWeeks(
  records: MemorizationRecord[],
  week1Start: Date,
  week1End: Date,
  week2Start: Date,
  week2End: Date
): { week1Avg: number; week2Avg: number; improvement: number } {
  const analysis1 = analyzeMemorizationPeriod(records, week1Start, week1End);
  const analysis2 = analyzeMemorizationPeriod(records, week2Start, week2End);

  return {
    week1Avg: analysis1.averageVersesPerSession,
    week2Avg: analysis2.averageVersesPerSession,
    improvement: analysis2.averageVersesPerSession - analysis1.averageVersesPerSession,
  };
}

/* ---------- الطلاب التجريبيون ---------- */
export function seedStudents(): Student[] {
  const mk = (
    name: string,
    xp: number,
    coins: number,
    pattern: number,
    awards: AwardRec[] = [],
    look: Partial<Pick<Student, "inventory" | "frame" | "crown" | "glow" | "cardBg" | "bag">> = {}
  ): Student => {
    const days = emptyWeekDays();
    let i = 0;
    for (const d of DAYS) {
      const bits = (pattern >> (i * 3)) & 0b111;
      days[d.key] = { a: !!(bits & 1), h: !!(bits & 2), r: !!(bits & 4) };
      i++;
    }
    return {
      id: "seed-" + name,
      name,
      photo: null,
      hearts: MAX_HEARTS,
      heartsLostWeek: 0,
      xp,
      weekXp: weekXpOf(days),
      weekCoins: weekCoinsOf(days),
      coins,
      days,
      ward: emptyWeeklyWard(),
      inventory: look.inventory ?? [],
      bag: look.bag ?? [],
      frame: look.frame ?? null,
      crown: look.crown ?? null,
      glow: look.glow ?? null,
      cardBg: look.cardBg ?? null,
      awards,
      memorizationRecords: [],
    };
  };
  return [
    mk("حمزة", 1100, 210, 0b111111111111, [{ id: uid(), title: "بطل الأسبوع", week: 3 }], {
      inventory: ["crown", "frame-gold", "glow-gold", "bg-yellow"],
      frame: "gold",
      crown: "gold",
      glow: "gold",
      cardBg: "yellow",
      bag: [
        { itemId: "gamenight", qty: 1, receivedQty: 0 },
        { itemId: "icecream", qty: 2, receivedQty: 1 },
      ],
    }),
    mk("مريم", 820, 150, 0b111111111110, [{ id: uid(), title: "جائزة أفضل سلوك", week: 2 }], {
      inventory: ["frame-rainbow", "glow-purple", "bg-purple"],
      frame: "rainbow",
      glow: "purple",
      cardBg: "purple",
      bag: [{ itemId: "chocolate", qty: 3, receivedQty: 1 }],
    }),
    mk("أحمد", 640, 110, 0b111111101111),
    mk("زينب", 480, 90, 0b111011111101, [{ id: uid(), title: "جائزة أفضل سلوك", week: 1 }]),
    mk("يوسف", 350, 65, 0b110110110110, [], { bag: [{ itemId: "stickers", qty: 2, receivedQty: 2 }] }),
    mk("ليلى", 240, 45, 0b101101101101),
    mk("عمر", 140, 30, 0b011011011011),
    mk("سارة", 70, 20, 0b010010010010),
  ];
}
