/* التسليمات — قائمتان: كل الجوائز غير المستلمة، وغير المستلمة فقط */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar } from "../core";
import Avatar from "./Avatar";
import { Icon, SectionHead } from "./ui";

export default function Deliveries() {
  const { students, products, deliverItem, undeliverItem } = useApp();
  const [pendingOnly, setPendingOnly] = useState(false);

  /* كل السجلات: طالب × منتج له وحدات في الحقيبة */
  const rows = useMemo(() => {
    const out: { studentId: string; itemId: string; qty: number; received: number }[] = [];
    for (const s of students) {
      for (const b of s.bag ?? []) {
        if (b.qty <= 0) continue;
        if (pendingOnly && b.receivedQty >= b.qty) continue;
        out.push({ studentId: s.id, itemId: b.itemId, qty: b.qty, received: b.receivedQty });
      }
    }
    return out.sort((a, b) => (b.qty - b.received) - (a.qty - a.received));
  }, [students, pendingOnly]);

  const totalPending = useMemo(
    () => students.reduce((n, s) => n + (s.bag ?? []).reduce((m, b) => m + Math.max(0, b.qty - b.receivedQty), 0), 0),
    [students]
  );

  return (
    <div className="anim-fade">
      <SectionHead
        icon="gift"
        title="تسليم الجوائز"
        desc="علّم ما سلّمته يدًا للطالب — القائمة الأولى تشمل الجميع، والثانية ما ينتظر التسليم فقط"
        color="bg-mint-400/20 text-mint-600"
        extra={
          <span className="rounded-2xl border-2 border-gold-500/50 bg-gold-400/20 px-4 py-2 font-display text-base font-extrabold text-gold-600">
            بانتظار التسليم: {ar(totalPending)}
          </span>
        }
      />

      {/* مبدّل القائمتين */}
      <div className="mb-4 flex rounded-2xl border-2 border-grape-200 bg-white p-1.5 sm:w-fit">
        <button
          type="button"
          onClick={() => setPendingOnly(false)}
          className={`flex-1 rounded-xl px-5 py-2.5 font-display text-sm font-extrabold transition-all sm:flex-none ${
            !pendingOnly ? "bg-grape-600 text-white shadow" : "text-grape-500 hover:text-grape-700"
          }`}
        >
          كل الجوائز
        </button>
        <button
          type="button"
          onClick={() => setPendingOnly(true)}
          className={`flex-1 rounded-xl px-5 py-2.5 font-display text-sm font-extrabold transition-all sm:flex-none ${
            pendingOnly ? "bg-gold-500 text-white shadow" : "text-grape-500 hover:text-grape-700"
          }`}
        >
          غير المستلمة فقط
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/70 p-14 text-center">
          <p className="font-display text-lg font-extrabold text-grape-600">
            {pendingOnly ? "لا توجد جوائز بانتظار التسليم — كل شيء سُلم" : "لا مشتريات خارجية بعد"}
          </p>
          <p className="mt-1 text-sm text-grape-700/70">عندما يشتري الطلاب جوائز خارجية من المتجر تظهر هنا لتسليمها</p>
        </div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {rows.map((r) => {
            const s = students.find((x) => x.id === r.studentId);
            const p = products.find((x) => x.id === r.itemId);
            if (!s || !p) return null;
            const pending = r.qty - r.received;
            const done = pending <= 0;
            return (
              <div key={s.id + r.itemId} className={`anim-slide-up flex items-center gap-3 rounded-2xl border-2 bg-white p-3 ${done ? "border-mint-400/60 bg-mint-400/5" : "border-grape-200"}`}>
                <Avatar photo={s.photo} name={s.name} size={52} frame={s.frame} crown={s.crown} glow={s.glow} />
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-grape-100 text-grape-500">
                      <Icon name={p.icon} className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-extrabold text-ink">{s.name} — {p.name}</p>
                  <p className={`text-[11px] font-extrabold ${done ? "text-mint-600" : "text-gold-600"}`}>
                    {done ? "استُلمت بالكامل" : `استلم ${ar(r.received)} من ${ar(r.qty)} · متبقي ${ar(pending)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {pending > 0 && (
                    <button
                      type="button"
                      onClick={() => deliverItem(s.id, r.itemId)}
                      className="flex items-center gap-1 rounded-xl bg-mint-600 px-3 py-2 text-xs font-extrabold text-white shadow-[0_3px_0_#0a7a50] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none"
                    >
                      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.4} />
                      سلّمت
                    </button>
                  )}
                  {r.received > 0 && (
                    <button
                      type="button"
                      onClick={() => undeliverItem(s.id, r.itemId)}
                      title="تراجع عن تسليم قطعة"
                      className="grid h-9 w-9 place-items-center rounded-xl border-2 border-grape-200 bg-white text-grape-400 transition hover:border-grape-400 active:scale-90"
                    >
                      <Icon name="minus" className="h-4 w-4" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
