import { useMemo } from "react";
import { useApp } from "../appState";
import { ar } from "../core";
import CosmeticThumb from "./CosmeticThumb";
import { Icon, Modal } from "./ui";

export default function StoreLevelRewards({ onClose }: { onClose: () => void }) {
  const { products } = useApp();
  const groups = useMemo(() => {
    const map = new Map<number, typeof products>();
    for (const product of [...products].sort((a, b) => a.minLevel - b.minLevel || a.name.localeCompare(b.name, "ar"))) {
      map.set(product.minLevel, [...(map.get(product.minLevel) ?? []), product]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [products]);

  return <Modal open onClose={onClose} wide>
    <div className="max-h-[88vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-grape-900 via-grape-800 to-grape-950 p-5 text-white sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-extrabold text-gold-300">تقدّم وافتح مكافآت جديدة</p><h2 className="mt-1 font-display text-3xl font-extrabold sm:text-5xl">🎁 جوائز المتجر ومستوياتها</h2><p className="mt-2 text-sm font-bold text-grape-200">كلما ارتفع مستواك ظهرت لك جوائز وخيارات جديدة في المتجر</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25"><Icon name="x" className="h-5 w-5" /></button></div>
      {groups.length === 0 ? <div className="mt-10 rounded-3xl border-2 border-dashed border-white/25 p-12 text-center font-display text-xl font-extrabold text-grape-200">لم تُضف جوائز إلى المتجر بعد</div> : <div className="mt-8 space-y-7">{groups.map(([level, items]) => <section key={level}><h3 className="mb-3 inline-flex rounded-full bg-gold-400 px-4 py-1.5 font-display text-base font-extrabold text-grape-950">المستوى {ar(level)}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((product) => <article key={product.id} className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur"><div className="h-40 overflow-hidden rounded-2xl bg-white/10">{product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : product.kind === "cosmetic" ? <CosmeticThumb slot={product.slot} value={product.value} /> : <div className="grid h-full place-items-center text-gold-300"><Icon name={product.icon || "gift"} className="h-16 w-16" strokeWidth={1.6}/></div>}</div><h4 className="mt-3 text-center font-display text-xl font-extrabold">{product.name}</h4><p className="mt-2 rounded-xl bg-white/15 py-2 text-center text-sm font-extrabold text-gold-300">المستوى المطلوب: {ar(product.minLevel)}</p></article>)}</div></section>)}</div>}
    </div>
  </Modal>;
}
