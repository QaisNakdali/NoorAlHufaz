/* المتجر — مرتب حسب المستويات، بكميات محدودة، منح مجاني، وصور تلقائية لخصائص البروفايل */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../appState";
import { ar, bagQty, isEquipped, levelInfo, MAX_HEARTS, uid, type CosmeticSlot, type ShopProduct, type Student } from "../core";
import { compressImage } from "../photos";
import { sfx } from "../sound";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { BigBtn, Coin, heartFade, HeartsRow, Icon, Modal, SectionHead } from "./ui";
import WeeklyAwards from "./WeeklyAwards";

/* شارة نوع العنصر */
function KindBadge({ p }: { p: ShopProduct }) {
  if (p.kind === "cosmetic")
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold text-white ${typeof p.stock === "number" ? "bg-gold-500" : "bg-grape-600"}`}>
        {typeof p.stock === "number" ? "خاصية · محدودة" : "خاصية بروفايل"}
      </span>
    );
  return <span className="rounded-full bg-mint-600 px-2 py-0.5 text-xs font-extrabold text-white">جائزة خارجية · متكررة</span>;
}

/* صورة المنتج: صورة المعلم إن وُجدت، وإلا رسم تلقائي لخصائص البروفايل */
function ProductImage({ p, dimmed = false }: { p: ShopProduct; dimmed?: boolean }) {
  return (
    <div className={`h-24 overflow-hidden rounded-xl ${dimmed ? "opacity-45 grayscale" : ""}`}>
      {p.image ? (
        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
      ) : p.kind === "cosmetic" ? (
        <CosmeticThumb slot={p.slot} value={p.value} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-grape-100 text-grape-500">
          <Icon name={p.icon} className="h-10 w-10" strokeWidth={1.8} />
        </div>
      )}
    </div>
  );
}

/* ===== بطاقة منتج في واجهة الشراء ===== */
export function BuyCard({ s, p, delay = 0, canGrant = false }: { s: Student; p: ShopProduct; delay?: number; canGrant?: boolean }) {
  const { buyItem, grantItem, restockProduct } = useApp();
  const lvl = levelInfo(s.xp).level;
  const isCosmetic = p.kind === "cosmetic";
  const qty = isCosmetic ? (s.inventory.includes(p.id) ? 1 : 0) : bagQty(s, p.id);
  const owned = qty > 0;
  const locked = lvl < p.minLevel;
  const poor = s.coins < p.price;
  const noHearts = s.hearts <= 0;
  const equipped = isCosmetic && isEquipped(s, p);
  const soldOut = owned && (isCosmetic || !p.repeatable);
  const hasStockLimit = typeof p.stock === "number";
  const outOfStock = hasStockLimit && (p.stock as number) <= 0;

  return (
    <div
      className={`card-shine anim-slide-up relative flex flex-col overflow-hidden rounded-2xl border-2 p-3.5 transition-all ${
        outOfStock
          ? "border-slate-200 bg-slate-100 opacity-55 saturate-0"
          : noHearts && !owned
          ? "border-slate-200 bg-slate-50 opacity-60 saturate-50"
          : locked
          ? "border-grape-100 bg-grape-50/70"
          : soldOut
          ? "border-mint-400/60 bg-mint-400/8"
          : "border-grape-200 bg-white hover:border-grape-400"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {locked && (
        <span className="absolute top-2.5 end-2.5 z-10 flex items-center gap-1 rounded-full bg-grape-600 px-2.5 py-1 text-xs font-extrabold text-white">
          <Icon name="lock" className="h-3 w-3" strokeWidth={2.6} />
          المستوى {ar(p.minLevel)}
        </span>
      )}
      {outOfStock && (
        <span className="absolute top-2.5 end-2.5 z-10 rounded-full bg-slate-500 px-2.5 py-1 text-xs font-extrabold text-white">نفدت الكمية</span>
      )}
      {soldOut && !outOfStock && (
        <span className="absolute top-2.5 end-2.5 z-10 flex items-center gap-1 rounded-full bg-mint-600 px-2.5 py-1 text-xs font-extrabold text-white">
          <Icon name="check" className="h-3 w-3" strokeWidth={3.4} />
          {isCosmetic ? (equipped ? "ملبوسة" : "مملوكة") : "في حقيبتك"}
        </span>
      )}
      <ProductImage p={p} dimmed={locked || outOfStock} />
      <div className="mt-2.5 flex items-center justify-between gap-1.5">
        <p className="font-display text-base font-extrabold leading-5 text-ink">{p.name}</p>
        <KindBadge p={p} />
      </div>
      <p className="mt-0.5 min-h-7 text-xs font-bold leading-4 text-grape-700/60">{p.desc}</p>
      {(qty > 0 || hasStockLimit) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {!isCosmetic && qty > 0 && (
            <p className="text-xs font-extrabold text-mint-600">في الحقيبة: {ar(qty)} {qty === 1 ? "قطعة" : "قطع"}</p>
          )}
          {hasStockLimit && (
            <p className={`text-xs font-extrabold ${outOfStock ? "text-slate-400" : isCosmetic ? "text-gold-600" : "text-grape-500"}`}>
              المتوفر: {ar(p.stock as number)} {isCosmetic && !outOfStock ? "فقط" : ""}
            </p>
          )}
        </div>
      )}
      <div className="mt-auto pt-2.5">
        <button
          type="button"
          onClick={() => buyItem(s.id, p.id)}
          disabled={soldOut || locked || poor || noHearts || outOfStock}
          title={noHearts && !owned ? "عليك شراء قلب جديد أولًا" : outOfStock ? "نفدت الكمية لدى المعلم" : undefined}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-sm font-extrabold transition-all active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed ${
            soldOut
              ? "bg-mint-400/20 text-mint-600"
              : outOfStock || noHearts
              ? "bg-slate-200 text-slate-400"
              : locked || poor
              ? "bg-grape-100 text-grape-400"
              : "bg-grape-600 text-white shadow-[0_4px_0_#56289d] hover:bg-grape-700"
          }`}
        >
          {soldOut ? (isCosmetic ? "تُلبس من الحقيبة" : "اشتريتها") : outOfStock ? "نفدت الكمية" : noHearts ? "اشترِ قلبًا أولًا" : locked ? "مقفل" : (
            <>
              <Coin className="h-4 w-4" />
              {ar(p.price)}
              {poor && <span className="text-xs">(عملاتك {ar(s.coins)})</span>}
            </>
          )}
        </button>
        {canGrant && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => grantItem(s.id, p.id)}
              disabled={outOfStock}
              title={`منح «${p.name}» لـ${s.name} مجانًا`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-gold-500/60 bg-gold-400/15 py-2 font-display text-xs font-extrabold text-gold-600 transition-all hover:bg-gold-400/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="gift" className="h-3.5 w-3.5" strokeWidth={2.4} />
              منح مجاني
            </button>
            {hasStockLimit && (
              <button
                type="button"
                onClick={() => restockProduct(p.id, 10)}
                title="زيادة الكمية المتوفرة بـ١٠"
                className="grid h-9 w-11 place-items-center rounded-xl border-2 border-mint-600/50 bg-mint-400/15 font-display text-xs font-extrabold text-mint-600 transition-all hover:bg-mint-400/35 active:scale-95"
              >
                +١٠
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== بطاقة شراء القلب ===== */
function HeartProductCard({ s }: { s: Student }) {
  const { buyHeart, heartPrice } = useApp();
  const full = s.hearts >= MAX_HEARTS;
  const poor = s.coins < heartPrice;
  return (
    <div className={`card-shine flex flex-wrap items-center gap-4 rounded-2xl border-2 p-4 ${s.hearts === 0 ? "anim-glow border-coral-400 bg-coral-500/8" : "border-grape-200 bg-white"}`}>
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${s.hearts === 0 ? "bg-coral-500 text-white" : "bg-coral-400/15 text-coral-500"}`}>
        <Icon name="heart" fill className="h-8 w-8" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold leading-6 text-ink">قلب جديد</p>
        <p className="text-xs font-bold text-grape-700/60">
          {s.hearts === 0
            ? "نفدت قلوبك! اشترِ قلبًا لتعود لنقاط المستوى والمنافسة"
            : "قلب احتياطي يعيدك للمنافسة إن خسرت قلوبك"}
        </p>
        <div className="mt-1"><HeartsRow hearts={s.hearts} max={MAX_HEARTS} size="w-4 h-4" /></div>
      </div>
      <button
        type="button"
        onClick={() => buyHeart(s.id)}
        disabled={full || poor}
        className="flex items-center gap-1.5 rounded-xl bg-coral-500 px-5 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_4px_0_#b23a55] transition-all hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
      >
        <Coin className="h-4 w-4" />
        {ar(heartPrice)}
      </button>
    </div>
  );
}

/* ===== واجهة شراء طالب — مرتبة حسب المستويات ===== */
export function StudentShop({ s, canGrant = false }: { s: Student; canGrant?: boolean }) {
  const { products } = useApp();
  const { level } = levelInfo(s.xp);

  const groups = useMemo(() => {
    const byLevel = new Map<number, ShopProduct[]>();
    for (const p of products) {
      const arr = byLevel.get(p.minLevel) ?? [];
      arr.push(p);
      byLevel.set(p.minLevel, arr);
    }
    return [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
  }, [products]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-grape-200 bg-white p-3">
        <div className={heartFade(s.hearts)}>
          <Avatar photo={s.photo} name={s.name} size={52} frame={s.frame} crown={s.crown} glow={s.glow} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-extrabold leading-6 text-ink">متجر {s.name}</p>
          <p className="text-xs font-bold text-grape-700/60">المستوى {ar(level)} — مرتب حسب المستويات، وبعض الهدايا تُفتح لاحقًا</p>
        </div>
        <span className="ms-auto flex items-center gap-1.5 rounded-full border-2 border-gold-500/50 bg-gold-400/20 px-3.5 py-1.5 font-display text-base font-extrabold text-gold-600">
          <Coin className="h-4.5 w-4.5" />
          {ar(s.coins)}
        </span>
      </div>

      {s.hearts <= 0 && (
        <div className="anim-pop mb-3 flex items-center gap-2.5 rounded-2xl border-2 border-coral-400/60 bg-coral-500/10 px-3.5 py-2.5">
          <Icon name="heart" fill className="h-5 w-5 shrink-0 text-coral-500" />
          <p className="text-xs font-extrabold leading-5 text-coral-500">
            نفدت قلوب {s.name} — لا يمكنه الشراء من المتجر الآن. عليه شراء قلب جديد أولًا ليعود، ووقتها تُفتح له كل المنتجات مجددًا.
          </p>
        </div>
      )}

      <HeartProductCard s={s} />

      {groups.map(([lvl, items]) => {
        const open = lvl <= level;
        return (
          <div key={lvl} className="mt-5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className={`grid h-8 w-8 place-items-center rounded-xl font-display text-sm font-extrabold ${open ? "bg-grape-600 text-white" : "bg-grape-200 text-grape-500"}`}>
                {ar(lvl)}
              </span>
              <p className="font-display text-base font-extrabold text-ink">هدايا المستوى {ar(lvl)}</p>
              {!open && (
                <span className="flex items-center gap-1 rounded-full bg-grape-100 px-2.5 py-0.5 text-xs font-extrabold text-grape-500">
                  <Icon name="lock" className="h-3 w-3" strokeWidth={2.6} />
                  تُفتح لاحقًا
                </span>
              )}
              <span className="ms-auto text-xs font-bold text-grape-700/50">{ar(items.length)} منتج</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p, i) => (
                <BuyCard key={p.id} s={s} p={p} delay={i * 40} canGrant={canGrant} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== خيارات خصائص البروفايل في نافذة التعديل ===== */
const COSMETIC_OPTIONS: { value: string; label: string }[] = [
  { value: "frame|silver", label: "إطار فضّي حول الصورة" },
  { value: "frame|gold", label: "إطار ذهبي حول الصورة" },
  { value: "frame|rainbow", label: "إطار قوس قزح متحرك" },
  { value: "frame|emerald", label: "إطار زمردي" },
  { value: "frame|coral", label: "إطار مرجاني" },
  { value: "frame|sky", label: "إطار سماوي" },
  { value: "frame|sunset", label: "إطار الغروب" },
  { value: "crown|gold", label: "تاج ذهبي فوق الصورة" },
  { value: "crown|silver", label: "تاج فضّي فوق الصورة" },
  { value: "glow|gold", label: "توهّج ذهبي حول الصورة" },
  { value: "glow|purple", label: "توهّج بنفسجي حول الصورة" },
  { value: "glow|mint", label: "توهّج نعناعي حول الصورة" },
  { value: "glow|coral", label: "توهّج مرجاني حول الصورة" },
  { value: "cardbg|red", label: "خلفية حمراء" },
  { value: "cardbg|orange", label: "خلفية برتقالية" },
  { value: "cardbg|yellow", label: "خلفية صفراء" },
  { value: "cardbg|green", label: "خلفية خضراء" },
  { value: "cardbg|sky", label: "خلفية سماوية" },
  { value: "cardbg|blue", label: "خلفية زرقاء" },
  { value: "cardbg|purple", label: "خلفية بنفسجية" },
  { value: "cardbg|pink", label: "خلفية وردية" },
  { value: "cardbg|night", label: "خلفية الليل بنجوم" },
];

/* ===== نافذة إضافة/تعديل منتج ===== */
function ProductModal({ initial, onClose }: { initial: ShopProduct | null; onClose: () => void }) {
  const { saveProduct, toast } = useApp();
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.desc ?? "");
  const [price, setPrice] = useState(initial?.price ?? 30);
  const [minLevel, setMinLevel] = useState(initial?.minLevel ?? 1);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [kind, setKind] = useState<"cosmetic" | "external">(initial?.kind ?? "external");
  const [cosmeticOpt, setCosmeticOpt] = useState(
    initial?.kind === "cosmetic" && initial.slot && initial.value ? `${initial.slot}|${initial.value}` : "frame|silver"
  );
  // الكمية المتوفرة لدى المعلم (فارغ = غير محدودة) — للنوعين
  const [stockStr, setStockStr] = useState(initial?.stock != null ? String(initial.stock) : "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [slot, value] = cosmeticOpt.split("|");

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      setImage(await compressImage(f, 320, true));
      sfx.pop();
    } catch {
      toast("error", "تعذّر قراءة الصورة");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!name.trim()) {
      toast("error", "اكتب اسم المنتج أولًا");
      sfx.error();
      return;
    }
    const item: ShopProduct = {
      id: initial ? initial.id : uid(),
      name: name.trim(),
      desc: desc.trim() || (kind === "cosmetic" ? "خاصية تجمّل بروفايلك" : "جائزة مميزة من معلمك"),
      price: Math.max(1, price),
      minLevel: Math.max(1, minLevel),
      image,
      icon: initial?.icon ?? (kind === "cosmetic" ? "sparkle" : "gift"),
      kind,
      slot: kind === "cosmetic" ? (slot as CosmeticSlot) : undefined,
      value: kind === "cosmetic" ? value : undefined,
      repeatable: kind === "external" ? true : undefined,
      stock: stockStr.trim() === "" ? (initial?.stock ?? null) : Math.max(0, Number(stockStr) || 0),
    };
    saveProduct(item);
    toast("success", initial ? "تم تحديث المنتج" : "أُضيف المنتج للمتجر");
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <div className="p-6">
        <h3 className="font-display text-2xl font-extrabold text-ink">{initial ? "تعديل المنتج" : "منتج جديد"}</h3>
        <div className="mt-5 flex items-start gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0" title="صورة المنتج">
            {image ? (
              <img src={image} alt="معاينة" className="h-24 w-24 rounded-2xl border-4 border-grape-200 object-cover transition group-hover:border-grape-400" />
            ) : kind === "cosmetic" ? (
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-grape-200 transition group-hover:border-grape-400">
                <CosmeticThumb slot={slot} value={value} />
              </div>
            ) : (
              <span className="dashed-border grid h-24 w-24 place-items-center rounded-2xl bg-grape-50 text-grape-400">
                {busy ? <span className="text-xs font-bold">جاري...</span> : <Icon name="store" className="h-9 w-9" strokeWidth={1.8} />}
              </span>
            )}
            <span className="absolute -bottom-1.5 -end-1.5 grid h-8 w-8 place-items-center rounded-full bg-grape-600 text-white shadow-lg transition group-hover:scale-110">
              <Icon name="plus" className="h-4 w-4" strokeWidth={3} />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <div className="flex-1 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-grape-700">اسم المنتج</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: كرة قدم" className="w-full rounded-xl border-2 border-grape-200 bg-grape-50 px-3.5 py-2 font-display font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-extrabold text-grape-700">وصف قصير</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="جائزة رائعة تنتظرك" className="w-full rounded-xl border-2 border-grape-200 bg-grape-50 px-3.5 py-2 text-sm font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white" />
            </div>
          </div>
        </div>

        {/* نوع المنتج */}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-extrabold text-grape-700">نوع المنتج</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("external")}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition active:scale-95 ${
                kind === "external" ? "border-mint-600 bg-mint-400/20 text-mint-600" : "border-grape-200 bg-white text-grape-500 hover:border-grape-400"
              }`}
            >
              جائزة خارجية (تُستلم يدًا)
            </button>
            <button
              type="button"
              onClick={() => setKind("cosmetic")}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition active:scale-95 ${
                kind === "cosmetic" ? "border-grape-600 bg-grape-600/12 text-grape-600" : "border-grape-200 bg-white text-grape-500 hover:border-grape-400"
              }`}
            >
              خاصية بروفايل (تُلبس)
            </button>
          </div>
        </div>

        {kind === "cosmetic" ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-extrabold text-grape-700">الخاصية</label>
            <div className="flex items-center gap-3">
              <select
                value={cosmeticOpt}
                onChange={(e) => setCosmeticOpt(e.target.value)}
                className="min-w-0 flex-1 cursor-pointer rounded-xl border-2 border-grape-200 bg-grape-50 px-3.5 py-2 font-display text-sm font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white"
              >
                {COSMETIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-grape-200">
                <CosmeticThumb slot={slot} value={value} />
              </div>
            </div>
            {!image && (
              <p className="mt-1.5 text-xs font-bold text-grape-700/55">تُرسم صورة المنتج تلقائيًا بلون الخاصية — أو ارفع صورة مخصصة إن أحببت</p>
            )}
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 rounded-xl border-2 border-mint-400/40 bg-mint-400/10 px-3.5 py-2.5 text-xs font-extrabold leading-5 text-mint-600">
            <Icon name="refresh" className="h-4 w-4 shrink-0" strokeWidth={2.4} />
            الجوائز الخارجية قابلة للتكرار دائمًا — يمكن شراؤها أكثر من مرة، وتُضاف للحقيبة كل مرة ليسلمها المعلم
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-extrabold text-grape-700">السعر (عملات)</label>
            <input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value) || 1)} className="w-full rounded-xl border-2 border-grape-200 bg-grape-50 px-3.5 py-2 font-display font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-grape-700">يُفتح في المستوى</label>
            <input type="number" min={1} value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value) || 1)} className="w-full rounded-xl border-2 border-grape-200 bg-grape-50 px-3.5 py-2 font-display font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-grape-700">الكمية المتوفرة</label>
            <input type="number" min={0} value={stockStr} onChange={(e) => setStockStr(e.target.value)} placeholder="غير محدودة" className="w-full rounded-xl border-2 border-grape-200 bg-grape-50 px-3.5 py-2 font-display font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white" />
          </div>
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-grape-700/60">
          {kind === "external"
            ? "حدّد كم قطعة عندك من هذه الجائزة. تنقص الكمية مع كل شراء، وعند نفادها تُقفل بلون باهت حتى تزيدها. اترك الحقل فارغًا لكمية غير محدودة."
            : "اجعلها نادرة ومحدودة ليزداد حماس الطلاب لها — مثلًا: ٣ إطارات قوس قزح فقط في الفصل كله! تنقص الكمية مع كل مشترٍ، وعند نفادها تُقفل بلون باهت حتى تزيدها. اترك الحقل فارغًا لكمية غير محدودة."}
        </p>

        {image && (
          <button type="button" onClick={() => setImage(null)} className="mt-3 text-xs font-bold text-coral-500 underline-offset-4 hover:underline">
            إزالة صورة المنتج {kind === "cosmetic" && "(ستُستخدم الصورة التلقائية)"}
          </button>
        )}

        <div className="mt-5 flex gap-2.5">
          <BigBtn className="flex-1" onClick={save} color="bg-mint-600 hover:brightness-110 shadow-[0_5px_0_#0a7a50]">
            <Icon name="check" className="h-5 w-5" strokeWidth={3} />
            {initial ? "حفظ التعديلات" : "إضافة للمتجر"}
          </BigBtn>
          <button type="button" onClick={onClose} className="rounded-2xl border-2 border-grape-200 bg-white px-5 font-display font-bold text-grape-500 transition hover:bg-grape-50">
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ===== تبويب المتجر (المعلم) ===== */
export default function StoreTab() {
  const { sorted, products, removeProduct, heartPrice, setHeartPrice } = useApp();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [heartPriceDraft, setHeartPriceDraft] = useState(heartPrice);
  const buyer = sorted.find((s) => s.id === buyerId) ?? null;

  // أبقِ حقل الإعداد مواكبًا لأي تغيير يصل من المزامنة السحابية.
  useEffect(() => setHeartPriceDraft(heartPrice), [heartPrice]);

  return (
    <div className="anim-fade">
      <SectionHead
        icon="store"
        title="متجر الهدايا"
        desc="أضف منتجاتك بصورها وكمياتها — خصائص البروفايل تُرسم صورتها تلقائيًا بلونها"
        color="bg-mint-400/20 text-mint-600"
        extra={
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setAwardsOpen(true)} className="rounded-2xl border-2 border-gold-500/50 bg-gold-400/20 px-4 py-2.5 font-display text-sm font-extrabold text-gold-700">🎁 جوائز المستويات</button><BigBtn
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
            color="bg-mint-600 hover:brightness-110 shadow-[0_5px_0_#0a7a50]"
          >
            <Icon name="plus" className="h-5 w-5" strokeWidth={3} />
            منتج جديد
          </BigBtn></div>
        }
      />

      <div className="mb-6 rounded-[24px] border-2 border-coral-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[190px] flex-1">
            <p className="font-display text-base font-extrabold text-ink">إعدادات المتجر</p>
            <label className="mt-3 block text-xs font-bold text-grape-600">
              سعر القلب الواحد
              <div className="mt-1 flex items-center gap-2">
                <input className="field-control w-32" type="number" min="0" step="1" value={heartPriceDraft} onChange={(e) => setHeartPriceDraft(Math.max(0, Number(e.target.value) || 0))} />
                <span className="font-extrabold text-grape-500">عملة</span>
              </div>
            </label>
          </div>
          <button type="button" onClick={() => setHeartPrice(heartPriceDraft)} className="rounded-2xl bg-coral-500 px-5 py-3 font-display text-sm font-extrabold text-white shadow-[0_4px_0_#b23a55] transition active:translate-y-0.5 active:shadow-none">حفظ السعر</button>
        </div>
        <p className="mt-3 rounded-xl bg-coral-50 px-3 py-2 text-sm font-extrabold text-coral-600">السعر الحالي: {ar(heartPrice)} عملة</p>
      </div>

      {/* إدارة المنتجات */}
      <div className="mb-6 rounded-[24px] border-2 border-grape-200 bg-white p-4">
        <p className="mb-3 font-display text-base font-extrabold text-ink">منتجات المتجر ({ar(products.length)})</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border-2 border-grape-100 bg-grape-50/50 p-2.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                ) : p.kind === "cosmetic" ? (
                  <CosmeticThumb slot={p.slot} value={p.value} />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-grape-100 text-grape-500">
                    <Icon name={p.icon} className="h-6 w-6" strokeWidth={1.8} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-extrabold text-ink">{p.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-grape-700/60">
                  <span className="flex items-center gap-0.5"><Coin className="h-3 w-3" />{ar(p.price)}</span>
                  <span>م{ar(p.minLevel)}</span>
                  <span className={p.kind === "cosmetic" ? "text-grape-500" : "text-mint-600"}>
                    {p.kind === "cosmetic" ? "خاصية" : "خارجية"}
                  </span>
                  {typeof p.stock === "number" && (
                    <span className={p.stock <= 0 ? "text-coral-500" : "text-gold-600"}>
                      {p.stock <= 0 ? "نفدت" : `متبقي ${ar(p.stock)}`}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => { setEditing(p); setEditorOpen(true); }}
                  title="تعديل"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-grape-600/12 text-grape-600 transition hover:bg-grape-600 hover:text-white active:scale-90"
                >
                  <Icon name="pencil" className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  onClick={() => removeProduct(p.id)}
                  title="حذف"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-coral-500/12 text-coral-500 transition hover:bg-coral-500 hover:text-white active:scale-90"
                >
                  <Icon name="x" className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* شراء نيابة عن طالب */}
      <div className="rounded-[24px] border-2 border-grape-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="font-display text-base font-extrabold text-ink">الشراء نيابة عن طالب</p>
          <select
            value={buyerId ?? ""}
            onChange={(e) => setBuyerId(e.target.value || null)}
            className="h-11 cursor-pointer rounded-2xl border-2 border-grape-200 bg-white px-3 font-display text-sm font-bold text-ink outline-none transition focus:border-grape-500"
          >
            <option value="">— اختر الطالب —</option>
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({ar(s.coins)} عملة)
              </option>
            ))}
          </select>
          <p className="text-xs font-bold text-grape-700/55">الشراء ينقص من رصيد الطالب · زر «منح مجاني» يهدي المنتج بلا عملات</p>
        </div>
        {buyer ? (
          <StudentShop s={buyer} canGrant />
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-grape-200 bg-white p-8 text-center text-sm font-bold text-grape-400">
            اختر طالبًا لعرض متجره والشراء من رصيده
          </p>
        )}
      </div>

      {editorOpen && <ProductModal initial={editing} onClose={() => setEditorOpen(false)} />}
      {awardsOpen && <WeeklyAwards onClose={() => setAwardsOpen(false)} />}
    </div>
  );
}
