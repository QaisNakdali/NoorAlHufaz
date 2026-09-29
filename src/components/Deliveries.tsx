/* التسليمات — الطلبات المؤرخة هي المصدر الأساسي، مع إبقاء المشتريات القديمة المتوافقة */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, type PurchaseOrder } from "../core";
import { formatHijriDate } from "../hijriDate";
import Avatar from "./Avatar";
import { SectionHead } from "./ui";

type LegacyRow = { studentId: string; itemId: string; qty: number; received: number };

export default function Deliveries() {
  const { students, products, deliverItem, undeliverItem, orders = [], deliverOrder, undeliverOrder } = useApp();
  const [view, setView] = useState<"pending" | "completed">("pending");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visibleOrders = useMemo(
    () => orders.filter((order) => students.some((student) => student.id === order.studentId) && order.itemKind !== "heart" && (view === "pending" ? order.status === "pending" : order.status === "delivered")),
    [orders, students, view],
  );

  /* bag كانت مصدر التسليم القديم. نعرض الوحدات التي لا يقابلها order فقط. */
  const legacyRows = useMemo(() => {
    const result: LegacyRow[] = [];
    for (const student of students) {
      for (const bag of student.bag ?? []) {
        const orderedQty = orders
          .filter((order) => order.studentId === student.id && order.itemId === bag.itemId)
          .reduce((sum, order) => sum + Math.max(1, order.quantity ?? 1), 0);
        const legacyQty = Math.max(0, bag.qty - orderedQty);
        if (legacyQty === 0) continue;
        const legacyReceived = Math.min(legacyQty, bag.receivedQty);
        const pending = legacyReceived < legacyQty;
        if ((view === "pending") !== pending) continue;
        result.push({ studentId: student.id, itemId: bag.itemId, qty: legacyQty, received: legacyReceived });
      }
    }
    return result;
  }, [orders, students, view]);

  const grouped = useMemo(() => {
    const map = new Map<string, { orders: PurchaseOrder[]; legacy: LegacyRow[] }>();
    for (const order of visibleOrders) {
      const group = map.get(order.studentId) ?? { orders: [], legacy: [] };
      group.orders.push(order);
      map.set(order.studentId, group);
    }
    for (const row of legacyRows) {
      const group = map.get(row.studentId) ?? { orders: [], legacy: [] };
      group.legacy.push(row);
      map.set(row.studentId, group);
    }
    return [...map.entries()];
  }, [legacyRows, visibleOrders]);

  const pendingCount = orders.filter((order) => students.some((student) => student.id === order.studentId) && order.itemKind !== "heart" && order.status === "pending").length
    + legacyRows.filter((row) => row.received < row.qty).length;
  const toggle = (studentId: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
    return next;
  });

  return (
    <div className="anim-fade">
      <SectionHead
        icon="gift"
        title="التسليمات"
        desc="كل عملية شراء تظهر مرة واحدة بمعرفها، وتسليمها لا يغير أي طلب آخر"
        color="bg-mint-400/20 text-mint-600"
        extra={<span className="rounded-2xl border-2 border-gold-500/50 bg-gold-400/20 px-4 py-2 font-display text-base font-extrabold text-gold-600">بانتظار التسليم: {ar(pendingCount)}</span>}
      />

      <div className="mb-4 flex rounded-2xl border-2 border-grape-200 bg-white p-1.5 sm:w-fit">
        {([['pending', 'التسليمات المعلقة'], ['completed', 'تم التسليم']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)} className={`flex-1 rounded-xl px-5 py-2.5 font-display text-sm font-extrabold transition-all sm:flex-none ${view === key ? "bg-grape-600 text-white shadow" : "text-grape-500 hover:text-grape-700"}`}>{label}</button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white/70 p-14 text-center">
          <p className="font-display text-lg font-extrabold text-grape-600">{view === "pending" ? "لا توجد تسليمات معلقة" : "لا توجد تسليمات مكتملة بعد"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([studentId, group]) => {
            const student = students.find((item) => item.id === studentId);
            const isOpen = expanded.has(studentId);
            const count = group.orders.length + group.legacy.length;
            return (
              <section key={studentId} className="overflow-hidden rounded-3xl border-2 border-grape-200 bg-white shadow-sm">
                <button type="button" onClick={() => toggle(studentId)} className="flex w-full items-center gap-3 p-4 text-start hover:bg-grape-50/60">
                  <Avatar photo={student?.photo ?? null} name={student?.name ?? group.orders[0]?.studentName ?? "طالب"} size={48} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-display text-base font-extrabold text-ink">{student?.name ?? group.orders[0]?.studentName ?? "طالب"}</span><span className="text-xs font-bold text-grape-500">{ar(count)} {count === 1 ? "طلب" : "طلبات"}</span></span>
                  <span className="text-grape-500">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="overflow-x-auto border-t border-grape-100">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="bg-grape-50 text-xs text-grape-600"><tr><th className="p-3 text-start">المنتج</th><th className="p-3">الكمية</th><th className="p-3">التاريخ</th><th className="p-3">الحالة</th><th className="p-3">الإجراء</th></tr></thead>
                      <tbody>
                        {group.orders.map((order) => (
                          <tr key={order.id} className="border-t border-grape-100">
                            <td className="p-3"><span className="font-extrabold text-ink">{order.itemName}</span><span className="block max-w-56 truncate text-[10px] text-grape-400">#{order.id}</span></td>
                            <td className="p-3 text-center font-bold">{ar(Math.max(1, order.quantity ?? 1))}</td>
                            <td className="p-3 text-center text-xs font-bold text-grape-500">{formatHijriDate(order.purchasedAt)}</td>
                            <td className="p-3 text-center"><span className={`rounded-xl px-2.5 py-1 text-xs font-black ${order.status === "delivered" ? "bg-mint-100 text-mint-800" : "bg-gold-100 text-gold-800"}`}>{order.status === "delivered" ? "تم التسليم ✓" : "لم يتم التسليم"}</span></td>
                            <td className="p-3 text-center">{order.status === "pending" ? <button type="button" onClick={() => deliverOrder(order.id)} className="rounded-xl bg-mint-600 px-3 py-2 text-xs font-extrabold text-white">✓ تسليم</button> : <button type="button" onClick={() => undeliverOrder(order.id)} className="rounded-xl border border-grape-200 px-3 py-2 text-xs font-bold text-grape-500">تراجع</button>}</td>
                          </tr>
                        ))}
                        {group.legacy.map((row) => {
                          const product = products.find((item) => item.id === row.itemId);
                          const done = row.received >= row.qty;
                          return (
                            <tr key={`legacy:${row.studentId}:${row.itemId}`} className="border-t border-grape-100">
                              <td className="p-3"><span className="font-extrabold text-ink">{product?.name ?? "جائزة محفوظة سابقًا"}</span><span className="block text-[10px] text-grape-400">سجل قديم محفوظ</span></td>
                              <td className="p-3 text-center font-bold">{ar(row.qty)}</td><td className="p-3 text-center text-xs text-grape-400">قبل سجل الطلبات</td>
                              <td className="p-3 text-center"><span className={`rounded-xl px-2.5 py-1 text-xs font-black ${done ? "bg-mint-100 text-mint-800" : "bg-gold-100 text-gold-800"}`}>{done ? "تم التسليم ✓" : `متبقي ${ar(row.qty - row.received)}`}</span></td>
                              <td className="p-3 text-center">{!done ? <button type="button" onClick={() => deliverItem(row.studentId, row.itemId)} className="rounded-xl bg-mint-600 px-3 py-2 text-xs font-extrabold text-white">✓ تسليم</button> : <button type="button" onClick={() => undeliverItem(row.studentId, row.itemId)} className="rounded-xl border border-grape-200 px-3 py-2 text-xs font-bold text-grape-500">تراجع</button>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
