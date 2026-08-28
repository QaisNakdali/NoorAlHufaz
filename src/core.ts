/* الأنواع والبيانات والمنطق الأساسي للمنصة */

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

export type AwardRec = { id: string; title: string; week: number };

/** مشتريات خارجية في الحقيبة — الكمية + ما سُلم منها */
export type BagEntry = { itemId: string; qty: number; receivedQty: number };

export type DayKey = "sun" | "mon" | "tue" | "wed";
export type DayPart = "a" | "h" | "r"; // حضور | تسميع حفظ | تسميع مراجعة
export type DayEntry = Record<DayPart, boolean>;
export type WeekDays = Record<DayKey, DayEntry>;

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
  const mk = (): DayEntry => ({ a: false, h: false, r: false });
  return { sun: mk(), mon: mk(), tue: mk(), wed: mk() };
}

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

export type Student = {
  id: string;
  name: string;
  photo: string | null;
  hearts: number;
  heartsLostWeek: number;
  xp: number;
  weekXp: number; // نقاط هذا الأسبوع من الكشف
  coins: number;
  days: WeekDays;
  inventory: string[]; // ids خصائص البروفايل المملوكة
  bag: BagEntry[]; // المشتريات الخارجية
  frame?: FrameKind | null;
  crown?: CrownKind | null;
  glow?: GlowKind | null;
  cardBg?: BgKind | null;
  awards: AwardRec[];
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
export const LEVEL_COIN_REWARD = 25;

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
  improved?: string;
  behavior?: string;
  champion1?: string;
  champion2?: string;
  champion3?: string;
};

export const AWARDS_META: {
  key: keyof CeremonyPicks;
  title: string;
  desc: string;
  coins: number;
  icon: string;
}[] = [
  { key: "behavior", title: "جائزة أفضل سلوك", desc: "قدوة في أدب الحلقة — بلا قلوب مفقودة", coins: 20, icon: "heart" },
  {
    key: "improved",
    title: "جائزة الأكثر تطوّرًا",
    desc: "اجتهد أكثر من ورده — الأكثر تسميعًا للحفظ والمراجعة",
    coins: 20,
    icon: "trend",
  },
];

/* ---------- أبطال الأسبوع — المراكز الثلاثة ---------- */
export const CHAMPION_TIERS: {
  key: keyof CeremonyPicks;
  title: string;
  short: string;
  desc: string;
  coins: number;
  icon: string;
  medal: string;
}[] = [
  {
    key: "champion1",
    title: "بطل الأسبوع — المركز الأول",
    short: "المركز الأول",
    desc: "أكمل أسبوعه: حضور + تسميع حفظ ومراجعة + الرحلة",
    coins: 30,
    icon: "trophy",
    medal: "bg-gold-500 text-white",
  },
  {
    key: "champion2",
    title: "بطل الأسبوع — المركز الثاني",
    short: "المركز الثاني",
    desc: "أكمل أسبوعه: حضور + تسميع حفظ ومراجعة + الرحلة",
    coins: 20,
    icon: "medal",
    medal: "bg-slate-400 text-white",
  },
  {
    key: "champion3",
    title: "بطل الأسبوع — المركز الثالث",
    short: "المركز الثالث",
    desc: "أكمل أسبوعه: حضور + تسميع حفظ ومراجعة + الرحلة",
    coins: 10,
    icon: "medal",
    medal: "bg-amber-600 text-white",
  },
];

/** عدد أيام الحضور هذا الأسبوع */
export const attendedDays = (s: Student): number => DAYS.filter((d) => s.days[d.key].a).length;
/** عدد خانات التسميع (حفظ + مراجعة) هذا الأسبوع */
export const recitations = (s: Student): number =>
  DAYS.reduce((n, d) => n + (s.days[d.key].h ? 1 : 0) + (s.days[d.key].r ? 1 : 0), 0);

/** استحقاق البطولة: أسبوع مكتمل (حضور كل الأيام + تسميع حفظ ومراجعة كل الأيام + الرحلة إن فُعّلت) */
export const isChampionEligible = (s: Student, tripOn: boolean, tripAttendees: string[]): boolean =>
  attendedDays(s) === DAYS.length &&
  recitations(s) === DAYS.length * 2 &&
  (!tripOn || tripAttendees.includes(s.id));

/** شروط البطولة (للعرض) */
export const championCriteria = (tripOn: boolean): { icon: string; label: string; active: boolean }[] => [
  { icon: "calendar", label: "حضر كل الأيام بلا غياب", active: true },
  { icon: "book", label: "سمّع الحفظ والمراجعة كل الأيام", active: true },
  { icon: "flag", label: tripOn ? "حضر الرحلة" : "الرحلة إن وُجدت", active: tripOn },
];

/** المؤهلون مرتّبون: الأقل فقدانًا للقلوب ثم الأعلى نقاطًا */
export function championTop(students: Student[], tripOn: boolean, tripAttendees: string[]): Student[] {
  return students
    .filter((s) => isChampionEligible(s, tripOn, tripAttendees))
    .sort(
      (a, b) =>
        a.heartsLostWeek - b.heartsLostWeek || b.weekXp - a.weekXp || b.xp - a.xp
    )
    .slice(0, 3);
}

/* ---------- الرحلة الأسبوعية ---------- */
export type TripDay = "thu" | "fri" | "sat";
export const TRIP_DAYS: { key: TripDay; label: string }[] = [
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
];
export const TRIP_COIN_REWARD = 20;

/* ---------- القلوب ---------- */
export const MAX_HEARTS = 3;
export const HEART_PRICE = 40;

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
};

export type WeekLog = {
  week: number;
  name: string;
  savedAt: string;
  top: WeekLogEntry[];
  awards: { title: string; studentName: string }[];
  trip?: { day: TripDay; attendeeNames: string[] } | null;
};

/* ---------- الواجهات ---------- */
export type Tab = "register" | "store" | "deliveries" | "board" | "ceremony" | "term";
export type Mode = "teacher" | "student";

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
      coins,
      days,
      inventory: look.inventory ?? [],
      bag: look.bag ?? [],
      frame: look.frame ?? null,
      crown: look.crown ?? null,
      glow: look.glow ?? null,
      cardBg: look.cardBg ?? null,
      awards,
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
