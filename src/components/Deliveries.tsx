/* صفحة التسليمات — إدارة تسليم جوائز ومشتريات الطلاب بدون تكرار وبحماية تامة */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, type PurchaseOrder } from "../core";
import Avatar from "./Avatar";
import { Icon, SectionHead } from "./ui";

export default function Deliveries() {
  const { students, products, orders = [], deliverOrder, undeliverOrder } = useApp();
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [showCompleted, setShowCompleted] = useState(false);

  // تصفية الأوامر الفيزيائية فقط (الجوائز الخارجية التي تتطلب تسليماً يدوياً)
  const physicalOrders = useMemo(() => {
    return orders.filter((o) => o.itemKind !== "cosmetic");
  }, [orders]);

  // تجميع التسليمات المعلقة حسب الطالب
  const pendingByStudent = useMemo(() => {
    const map = new Map<string, { student: (typeof students)[0]; pendingOrders: PurchaseOrder[] }>();
    
    for (const order of physicalOrders) {
      if (order.status === "delivered") continue;
      const s = students.find((x) => x.id === order.studentId);
      if (!s) continue;
      
      if (!map.has(s.id)) {
        map.set(s.id, { student: s, pendingOrders: [] });
      }
      map.get(s.id)!.pendingOrders.push(order);
    }
    
    return [...map.values()].sort((a, b) => b.pendingOrders.length - a.pendingOrders.length || a.student.name.localeCompare(b.student.name, "ar"));
  }, [physicalOrders, students]);

  // التسليمات المكتملة (المسلمة)
  const completedOrders = useMemo(() => {
    return physicalOrders
      .filter((o) => o.status === "delivered")
      .sort((a, b) => new Date(b.deliveredAt || b.purchasedAt).getTime() - new Date(a.deliveredAt || a.purchasedAt).getTime());
  }, [physicalOrders]);

  const totalPendingUnits = useMemo(() => {
    return physicalOrders
      .filter((o) => o.status !== "delivered")
      .reduce((sum, o) => sum + (o.qty ?? 1), 0);
  }, [physicalOrders]);

  const toggleStudent = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  return (
    <div className="anim-fade space-y-6" dir="rtl">
      <SectionHead
        icon="gift"
        title="تسليم الجوائز والمشتريات"
        desc="متابعة تسليم الجوائز والمشتريات الخارجية يدًا للطلاب — كل عملية شراء موثقة برقم مستقل دون أي تكرار"
        color="bg-mint-400/20 text-mint-600"
        extra={
          <span className="rounded-2xl border-2 border-gold-500/50 bg-gold-400/20 px-4 py-2 font-display text-base font-extrabold text-gold-700 shadow-xs">
            بانتظار التسليم: {ar(totalPendingUnits)} قطعة
          </span>
        }
      />

      {/* التبويبات العلوية */}
      <div className="flex flex-wrap items-center gap-2 border-b border-grape-100 pb-3">
        <button
          type="button"
          onClick={() => setShowCompleted(false)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black transition ${
            !showCompleted
              ? "bg-grape-600 text-white shadow-sm"
              : "bg-white text-grape-600 border border-grape-200 hover:bg-grape-50"
          }`}
        >
          <span>⏳ التسليمات المعلقة</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
            {ar(pendingByStudent.length)} طالب
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowCompleted(true)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black transition ${
            showCompleted
              ? "bg-grape-600 text-white shadow-sm"
              : "bg-white text-grape-600 border border-grape-200 hover:bg-grape-50"
          }`}
        >
          <span>✓ التسليمات المكتملة</span>
          <span className="rounded-full bg-mint-100 text-mint-800 px-2 py-0.5 text-[11px]">
            {ar(completedOrders.length)}
          </span>
        </button>
      </div>

      {/* 1. قسم التسليمات المعلقة */}
      {!showCompleted && (
        <div className="space-y-4">
          {pendingByStudent.length === 0 ? (
            <div className="dashed-border rounded-3xl bg-white/80 p-12 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-50 text-mint-600 text-2xl mb-3">
                ✓
              </span>
              <p className="font-display text-lg font-extrabold text-ink">
                رائع! تم تسليم جميع مشتريات وجوائز الطلاب بالكامل
              </p>
              <p className="mt-1 text-xs font-bold text-grape-500">
                لا توجد أي جوائز معلقة بانتظار التسليم حاليًا.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingByStudent.map(({ student: s, pendingOrders }) => {
                const isExpanded = expandedStudents[s.id] ?? true; // الافتراضي مفتوح لسهولة المعلم
                const pendingCount = pendingOrders.reduce((sum, o) => sum + (o.qty ?? 1), 0);

                return (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-2xl border-2 border-grape-200 bg-white shadow-xs transition hover:border-grape-300"
                  >
                    {/* رأس بطاقة الطالب */}
                    <div
                      onClick={() => toggleStudent(s.id)}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-l from-grape-50/50 via-white to-white transition hover:bg-grape-50"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar photo={s.photo} name={s.name} size={48} frame={s.frame} crown={s.crown} glow={s.glow} />
                        <div className="min-w-0">
                          <p className="truncate font-display text-base font-extrabold text-ink">
                            {s.name}
                          </p>
                          <p className="text-xs font-bold text-grape-500">
                            متبقي للتسليم: <strong className="text-gold-700">{ar(pendingCount)} قطعة</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-gold-100 text-gold-800 px-3 py-1 text-xs font-black">
                          {ar(pendingOrders.length)} طلب معلق
                        </span>
                        <span className={`transform transition-transform text-grape-400 font-bold text-sm ${isExpanded ? "rotate-180" : ""}`}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* تفاصيل المنتجات المشتراة */}
                    {isExpanded && (
                      <div className="border-t border-grape-100 p-3 sm:p-4 bg-slate-50/40">
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-grape-200/60 text-grape-500 font-black">
                                <th className="pb-2 pe-3">المنتج</th>
                                <th className="pb-2 px-3 text-center">الكمية</th>
                                <th className="pb-2 px-3 text-center">السعر</th>
                                <th className="pb-2 px-3 text-center">الحالة</th>
                                <th className="pb-2 ps-3 text-center">الإجراء</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-grape-100/80">
                              {pendingOrders.map((order) => {
                                const prod = products.find((p) => p.id === order.itemId);
                                const qty = order.qty ?? 1;

                                return (
                                  <tr key={order.id} className="hover:bg-white/80 transition">
                                    <td className="py-2.5 pe-3">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white border border-grape-200 flex items-center justify-center p-1">
                                          {order.itemImage ? (
                                            <img src={order.itemImage} alt={order.itemName} className="h-full w-full object-contain" />
                                          ) : (
                                            <Icon name={order.itemIcon || "gift"} className="h-5 w-5 text-grape-500" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-display font-black text-ink truncate text-sm">
                                            {order.itemName}
                                          </p>
                                          <p className="text-[10px] font-mono text-grape-400">
                                            #{order.id.slice(0, 8)}
                                          </p>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-3 text-center font-display font-extrabold text-ink text-sm">
                                      {qty > 1 ? `${ar(qty)} ×` : ar(qty)}
                                    </td>

                                    <td className="py-2.5 px-3 text-center font-bold text-gold-700">
                                      {ar(order.price)} 🪙
                                    </td>

                                    <td className="py-2.5 px-3 text-center">
                                      <span className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-800 whitespace-nowrap">
                                        لم يتم التسليم ⏳
                                      </span>
                                    </td>

                                    <td className="py-2.5 ps-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => deliverOrder(order.id)}
                                        className="inline-flex items-center gap-1 rounded-xl bg-mint-600 px-3.5 py-1.5 font-display text-xs font-black text-white shadow-[0_3px_0_#0a7a50] hover:bg-mint-700 active:translate-y-0.5 active:shadow-none transition"
                                      >
                                        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.4} />
                                        <span>تسليم</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. قسم التسليمات المكتملة */}
      {showCompleted && (
        <div className="space-y-3">
          {completedOrders.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white p-12 text-center font-bold text-grape-400">
              لا توجد تسليمات مكتملة بعد.
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {completedOrders.map((order) => {
                const s = students.find((x) => x.id === order.studentId);
                const dDate = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.purchasedAt);

                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-mint-200 bg-mint-50/20 p-3 shadow-xs transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar photo={s?.photo ?? null} name={order.studentName} size={42} />
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-extrabold text-ink">
                          {order.studentName} — {order.itemName}
                        </p>
                        <p className="text-[11px] font-bold text-grape-500">
                          الكمية: {ar(order.qty ?? 1)} &bull; سُلّمت: {dDate.toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-xl bg-mint-100 text-mint-800 px-2.5 py-1 text-xs font-black">
                        تم التسليم ✓
                      </span>
                      <button
                        type="button"
                        onClick={() => undeliverOrder(order.id)}
                        className="rounded-xl border border-grape-200 bg-white px-2 py-1 text-xs font-bold text-grape-400 hover:text-coral-500 transition"
                        title="تراجع عن التسليم في حال الخطأ"
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
