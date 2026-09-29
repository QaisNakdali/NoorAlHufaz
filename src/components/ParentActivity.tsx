/* نشاط بوابة أولياء الأمور — متابعة زيارات البوابة، نشاط المتجر والطلبات، ودليل الروابط */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, generateParentToken } from "../core";
import Avatar from "./Avatar";
import { Icon, Modal, SectionHead } from "./ui";

export default function ParentActivity() {
  const {
    students,
    halaqas,
    orders,
    parentLogs,
    clearParentActivity,
    deliverOrder,
    undeliverOrder,
    updateStudentProfile,
    toast,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<"logs" | "orders" | "links">("logs");
  const [searchQuery, setSearchQuery] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [clearError, setClearError] = useState("");
  const [clearing, setClearing] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.guardianPhone && s.guardianPhone.includes(q))
    );
  }, [students, searchQuery]);

  // نحتفظ بالسجلات التاريخية في البيانات، لكن الطالب المحذوف لا يبقى ظاهرًا كطالب نشط.
  const activeStudentIds = useMemo(() => new Set(students.map((student) => student.id)), [students]);
  const activeParentLogs = useMemo(() => parentLogs.filter((log) => activeStudentIds.has(log.studentId)), [activeStudentIds, parentLogs]);
  const activeOrders = useMemo(() => orders.filter((order) => activeStudentIds.has(order.studentId)), [activeStudentIds, orders]);

  const totalVisits = activeParentLogs.length;
  const totalPurchases = activeOrders.length;
  const storeVisitorsCount = activeParentLogs.filter((l) => l.enteredStore).length;

  return (
    <div className="anim-fade space-y-5" dir="rtl">
      <SectionHead
        icon="users"
        title="نشاط بوابة أولياء الأمور"
        desc="متابعة زيارات أولياء الأمور للبوابة، سجل نشاط المتجر، ودليل روابط الطلاب الدائمة"
        color="bg-grape-600/10 text-grape-700"
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-grape-200 bg-white px-3 py-1.5 text-xs font-black text-grape-700 shadow-xs">
              إجمالي الزيارات: {ar(totalVisits)}
            </span>
            <span className="rounded-xl border border-gold-200 bg-gold-50 px-3 py-1.5 text-xs font-black text-gold-800 shadow-xs">
              مشتريات البوابة: {ar(totalPurchases)}
            </span>
            <button type="button" onClick={() => { setConfirmationCode(""); setClearError(""); setClearOpen(true); }} className="rounded-xl border border-coral-200 bg-white px-3 py-1.5 text-xs font-black text-coral-700 shadow-xs hover:bg-coral-50">
              حذف سجل النشاط
            </button>
          </div>
        }
      />

      {/* شريط الإحصائيات السريعة */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-grape-100 bg-white p-4 shadow-xs">
          <p className="text-xs font-extrabold text-grape-400">إجمالي جلسات الدخول</p>
          <p className="mt-1 font-display text-2xl font-black text-grape-700">{ar(totalVisits)}</p>
          <p className="mt-0.5 text-[11px] font-bold text-grape-400">جلسات دخول أولياء الأمور المسجلة</p>
        </div>
        <div className="rounded-2xl border-2 border-mint-100 bg-white p-4 shadow-xs">
          <p className="text-xs font-extrabold text-mint-600">دخلوا المتجر</p>
          <p className="mt-1 font-display text-2xl font-black text-mint-700">{ar(storeVisitorsCount)}</p>
          <p className="mt-0.5 text-[11px] font-bold text-mint-600/70">أولياء أمور تصفحوا المتجر</p>
        </div>
        <div className="rounded-2xl border-2 border-gold-100 bg-white p-4 shadow-xs">
          <p className="text-xs font-extrabold text-gold-600">عمليات الشراء</p>
          <p className="mt-1 font-display text-2xl font-black text-gold-700">{ar(totalPurchases)}</p>
          <p className="mt-0.5 text-[11px] font-bold text-gold-600/70">طلبات شراء مسجلة من البوابة</p>
        </div>
      </div>

      {/* التبويبات الداخلية */}
      <div className="flex flex-wrap gap-2 border-b border-grape-100 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("logs")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black transition ${
            activeSubTab === "logs"
              ? "bg-grape-600 text-white shadow-sm"
              : "bg-white text-grape-600 border border-grape-200 hover:bg-grape-50"
          }`}
        >
          <span>👁️</span>
          <span>سجل زيارات الأولياء ({ar(activeParentLogs.length)})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("orders")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black transition ${
            activeSubTab === "orders"
              ? "bg-grape-600 text-white shadow-sm"
              : "bg-white text-grape-600 border border-grape-200 hover:bg-grape-50"
          }`}
        >
          <span>🛍️</span>
          <span>نشاط المتجر والطلبات ({ar(activeOrders.length)})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("links")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black transition ${
            activeSubTab === "links"
              ? "bg-grape-600 text-white shadow-sm"
              : "bg-white text-grape-600 border border-grape-200 hover:bg-grape-50"
          }`}
        >
          <span>🔗</span>
          <span>دليل روابط الطلاب ({ar(students.length)})</span>
        </button>
      </div>

      {/* محتوى التبويب الأول: سجل الزيارات */}
      {activeSubTab === "logs" && (
        <div className="space-y-3">
          {activeParentLogs.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white/70 p-12 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl mb-2">
                ⏳
              </span>
              <p className="font-display text-base font-extrabold text-ink">لا توجد زيارات مسجلة بعد</p>
              <p className="mt-1 text-xs font-bold text-grape-500">
                عندما يفتح ولي الأمر الرابط الخاص بابنه، سيتم تسجيل تاريخ الدخول والنشاط تلقائيًا هنا.
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {activeParentLogs.map((log) => {
                const s = students.find((x) => x.id === log.studentId);
                const enterDate = new Date(log.enteredAt);
                const lastDate = new Date(log.lastActiveAt);
                const timeDiffMins = Math.max(1, Math.round((lastDate.getTime() - enterDate.getTime()) / (60 * 1000)));

                return (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-grape-100 bg-white p-3.5 shadow-xs hover:border-grape-200 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar photo={s?.photo ?? null} name={log.studentName} size={42} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black text-ink">{log.studentName}</span>
                          <span className="rounded-full bg-grape-100 px-2 py-0.2 text-[10px] font-extrabold text-grape-700">
                            ولي أمر
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-grape-500">
                          الدخول: {enterDate.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" })} &bull; تاريخ: {enterDate.toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 ms-auto sm:ms-0">
                      <span className="rounded-xl border border-grape-200 bg-grape-50 px-2.5 py-1 text-xs font-bold text-grape-700">
                        مدة التصفح: {ar(timeDiffMins)} دقيقة
                      </span>
                      {log.enteredStore ? (
                        <span className="rounded-xl border border-mint-200 bg-mint-50 px-2.5 py-1 text-xs font-bold text-mint-800">
                          تصفح المتجر ✓
                        </span>
                      ) : (
                        <span className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">
                          لم يدخل المتجر
                        </span>
                      )}
                      {log.purchased && (
                        <span className="rounded-xl border border-gold-200 bg-gold-50 px-2.5 py-1 text-xs font-bold text-gold-800">
                          أتم شراء 🎉
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

      {/* محتوى التبويب الثاني: نشاط المتجر والطلبات */}
      {activeSubTab === "orders" && (
        <div className="space-y-3">
          {activeOrders.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white/70 p-12 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gold-50 text-2xl mb-2">
                🛍️
              </span>
              <p className="font-display text-base font-extrabold text-ink">لا توجد طلبات شراء مسجلة بعد</p>
              <p className="mt-1 text-xs font-bold text-grape-500">
                عندما يُتم ولي الأمر عملية شراء من متجر ابنه، سيظهر الطلب هنا وفي صفحة التسليمات.
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {activeOrders.map((order) => {
                const s = students.find((x) => x.id === order.studentId);
                const isDone = order.status === "delivered";
                const pDate = new Date(order.purchasedAt);

                return (
                  <div
                    key={order.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-3.5 shadow-xs transition ${
                      isDone ? "border-mint-200 bg-mint-50/20" : "border-gold-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar photo={s?.photo ?? null} name={order.studentName} size={44} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black text-ink">{order.studentName}</span>
                          <span className="text-xs text-grape-400">&bull; اشترى:</span>
                          <span className="font-extrabold text-sm text-grape-800">{order.itemName}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-grape-500">
                          السعر: {ar(order.price)} عملة &bull; التاريخ: {pDate.toLocaleDateString("ar-SA")} الساعة {pDate.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ms-auto sm:ms-0">
                      {isDone ? (
                        <span className="rounded-xl bg-mint-100 px-3 py-1 text-xs font-black text-mint-800">
                          تم التسليم ✓
                        </span>
                      ) : (
                        <span className="rounded-xl bg-gold-100 px-3 py-1 text-xs font-black text-gold-800">
                          بانتظار التسليم ⏳
                        </span>
                      )}

                      {!isDone ? (
                        <button
                          type="button"
                          onClick={() => deliverOrder(order.id)}
                          className="flex items-center gap-1 rounded-xl bg-mint-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-mint-700 transition"
                        >
                          <Icon name="check" className="h-3.5 w-3.5" />
                          <span>تأكيد التسليم</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => undeliverOrder(order.id)}
                          className="rounded-xl border border-grape-200 bg-white px-2.5 py-1 text-xs font-bold text-grape-600 hover:bg-grape-50 transition"
                          title="تراجع عن حالة التسليم"
                        >
                          تراجع
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* محتوى التبويب الثالث: دليل روابط الطلاب */}
      {activeSubTab === "links" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو رقم الهاتف..."
              className="field-control max-w-sm text-xs font-bold"
            />
          </div>

          <div className="grid gap-2.5">
            {filteredStudents.map((s) => {
              const h = halaqas.find((x) => x.id === s.halaqaId);
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/parent/${s.parentAccessToken}`;

              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-grape-100 bg-white p-3.5 shadow-xs hover:border-grape-200 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar photo={s.photo} name={s.name} size={42} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-black text-ink">{s.name}</span>
                        {h && (
                          <span className="rounded-full bg-grape-100 px-2 py-0.2 text-[10px] font-extrabold text-grape-700">
                            {h.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-grape-500 font-bold">
                        {s.guardianPhone ? (
                          <span>📱 {s.guardianPhone}</span>
                        ) : (
                          <span className="text-coral-500">(لا يوجد رقم مسجل)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ms-auto sm:ms-0">
                    <input
                      type="text"
                      readOnly
                      dir="ltr"
                      value={link}
                      className="w-48 sm:w-64 truncate rounded-xl border border-grape-200 bg-grape-50 px-2.5 py-1 text-xs font-mono select-all text-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        toast("success", `تم نسخ رابط ولي أمر ${s.name}`);
                      }}
                      className="rounded-xl bg-grape-600 px-3 py-1.5 text-xs font-black text-white hover:bg-grape-700 transition"
                    >
                      نسخ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`هل أنت متأكد من تجديد رابط الطالب ${s.name}؟ سيتوقف الرابط القديم فورًا.`)) {
                          const newToken = generateParentToken();
                          updateStudentProfile(s.id, { parentAccessToken: newToken });
                          toast("success", "تم تجديد الرابط بنجاح");
                        }
                      }}
                      className="rounded-xl border border-coral-200 bg-coral-50 px-2.5 py-1.5 text-xs font-bold text-coral-700 hover:bg-coral-100 transition"
                      title="إعادة إنشاء الرابط وإبطال القديم"
                    >
                      تجديد
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={clearOpen} onClose={() => !clearing && setClearOpen(false)}>
        <div className="space-y-4 p-5" dir="rtl">
          <div>
            <h3 className="font-display text-lg font-black text-ink">حذف سجل نشاط أولياء الأمور</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-grape-600">سيتم حذف سجل الزيارات المعروض فقط. لن تُحذف المشتريات الحقيقية أو الطلاب أو العملات أو القلوب أو المنتجات.</p>
          </div>
          <label className="block text-xs font-black text-grape-700">
            رمز التأكيد
            <input type="password" inputMode="numeric" value={confirmationCode} onChange={(event) => { setConfirmationCode(event.target.value); setClearError(""); }} placeholder="أدخل رمز التأكيد" className="field-control mt-1 w-full" autoComplete="off" />
          </label>
          {clearError && <p className="rounded-xl bg-coral-50 px-3 py-2 text-xs font-black text-coral-700">{clearError}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={clearing} onClick={async () => {
              setClearing(true);
              const result = await clearParentActivity(confirmationCode);
              setClearing(false);
              if (result.success) setClearOpen(false);
              else setClearError(result.error || "تعذر حذف السجل");
            }} className="min-h-11 flex-1 rounded-xl bg-coral-500 px-4 text-xs font-black text-white disabled:opacity-50">
              {clearing ? "جاري الحذف..." : "تأكيد حذف السجل"}
            </button>
            <button type="button" disabled={clearing} onClick={() => setClearOpen(false)} className="min-h-11 rounded-xl border border-grape-200 px-4 text-xs font-black text-grape-600">إلغاء</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
