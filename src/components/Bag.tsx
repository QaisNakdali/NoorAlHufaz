/* حقيبة الطالب — قسمان منفصلان: خصائص البروفايل (تُلبس) والمشتريات الخارجية (تُستلم) */
import { useApp } from "../appState";
import { ar, bagReceivedQty, isEquipped, levelInfo, rankOf, type Student } from "../core";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { Coin, Icon } from "./ui";

function SlotLabel({ slot }: { slot?: string }) {
  const label =
    slot === "frame" ? "إطار الصورة" : slot === "crown" ? "التاج" : slot === "glow" ? "التوهّج" : slot === "cardbg" ? "خلفية البطاقة" : "خاصية";
  return <span className="rounded-full bg-grape-100 px-2 py-0.5 text-[9px] font-extrabold text-grape-600">{label}</span>;
}

export default function StudentBag({ s }: { s: Student }) {
  const { products, equipCosmetic, unequipSlot, deliverItem, undeliverItem } = useApp();
  const { level } = levelInfo(s.xp);

  const ownedCosmetics = products.filter((p) => p.kind === "cosmetic" && s.inventory.includes(p.id));
  const externalEntries = (s.bag ?? []).filter((b) => b.qty > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-grape-200 bg-white p-3">
        <Avatar photo={s.photo} name={s.name} size={56} frame={s.frame} crown={s.crown} glow={s.glow} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-extrabold leading-6 text-ink">حقيبة {s.name}</p>
          <p className="text-[11px] font-bold text-grape-700/60">
            المستوى {ar(level)} · {rankOf(level)} · خصائص البروفايل والمشتريات في قسمين منفصلين
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border-2 border-gold-500/50 bg-gold-400/20 px-3.5 py-1.5 font-display text-base font-extrabold text-gold-600">
          <Coin className="h-4.5 w-4.5" />
          {ar(s.coins)}
        </span>
      </div>

      {/* ===== القسم الأول: خصائص البروفايل ===== */}
      <div className="rounded-2xl border-2 border-grape-200 bg-grape-50/50 p-4">
        <p className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink">
          <Icon name="sparkle" className="h-5 w-5 text-grape-600" strokeWidth={2.2} />
          خصائص البروفايل
          <span className="text-[10px] font-bold text-grape-700/55">البس ما يعجبك وخلّعه متى شئت</span>
        </p>
        {ownedCosmetics.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-grape-200 bg-white p-5 text-center text-xs font-bold text-grape-400">
            لا يملك خصائص بعد — يشتريها من المتجر وتظهر هنا ليلبسها
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {ownedCosmetics.map((p) => {
              const equipped = isEquipped(s, p);
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-2.5 ${equipped ? "border-gold-500/70 shadow-[0_0_16px_rgba(247,183,51,0.25)]" : "border-grape-100"}`}>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <CosmeticThumb slot={p.slot} value={p.value} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-extrabold text-ink">{p.name}</p>
                    <SlotLabel slot={p.slot} />
                  </div>
                  <button
                    type="button"
                    onClick={() => (equipped && p.slot ? unequipSlot(s.id, p.slot) : equipCosmetic(s.id, p.id))}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
                      equipped
                        ? "border-2 border-grape-200 bg-white text-grape-500 hover:border-grape-400"
                        : "bg-grape-600 text-white shadow-[0_3px_0_#56289d] hover:bg-grape-700"
                    }`}
                  >
                    {equipped ? "خلع" : "لبس"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== القسم الثاني: المشتريات الخارجية ===== */}
      <div className="mt-4 rounded-2xl border-2 border-grape-200 bg-mint-400/5 p-4">
        <p className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink">
          <Icon name="gift" className="h-5 w-5 text-mint-600" strokeWidth={2.2} />
          المشتريات الخارجية
          <span className="text-[10px] font-bold text-grape-700/55">يسلمها المعلم يدًا ويعلّم الاستلام من تبويب «التسليمات»</span>
        </p>
        {externalEntries.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-grape-200 bg-white p-5 text-center text-xs font-bold text-grape-400">
            لا مشتريات خارجية بعد — يشتريها من المتجر وتُضاف هنا
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {externalEntries.map((b) => {
              const p = products.find((x) => x.id === b.itemId);
              if (!p) return null;
              const pending = b.qty - b.receivedQty;
              const done = pending <= 0;
              return (
                <div key={b.itemId} className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-2.5 ${done ? "border-mint-400/60" : "border-grape-100"}`}>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-grape-100 text-grape-500">
                        <Icon name={p.icon} className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-extrabold text-ink">{p.name}</p>
                    <p className={`text-[10px] font-extrabold ${done ? "text-mint-600" : "text-gold-600"}`}>
                      {done ? `استُلمت بالكامل (${ar(b.qty)})` : `استلم ${ar(b.receivedQty)} من ${ar(b.qty)} — متبقي ${ar(pending)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {pending > 0 && (
                      <button
                        type="button"
                        onClick={() => deliverItem(s.id, b.itemId)}
                        title="تعليم قطعة كمُستلمة"
                        className="flex items-center gap-1 rounded-xl bg-mint-600 px-2.5 py-1.5 text-[10px] font-extrabold text-white shadow-[0_2px_0_#0a7a50] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none"
                      >
                        <Icon name="check" className="h-3 w-3" strokeWidth={3.4} />
                        استلم
                      </button>
                    )}
                    {b.receivedQty > 0 && (
                      <button
                        type="button"
                        onClick={() => undeliverItem(s.id, b.itemId)}
                        title="تراجع عن تسليم قطعة"
                        className="grid h-7 w-7 place-items-center rounded-lg border-2 border-grape-200 bg-white text-grape-400 transition hover:border-grape-400 active:scale-90"
                      >
                        <Icon name="minus" className="h-3 w-3" strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {externalEntries.length > 0 && (
          <p className="mt-2 text-center text-[10px] font-bold text-grape-700/50">
            إجمالي ما استلمه: {ar(externalEntries.reduce((n, b) => n + bagReceivedQty(s, b.itemId), 0))} قطعة
          </p>
        )}
      </div>
    </div>
  );
}
