import { useApp } from "../appState";
import { ar, levelInfo } from "../core";
import Avatar from "./Avatar";
import { Coin, Icon, Modal } from "./ui";

export default function WeeklyAwards({ onClose }: { onClose: () => void }) {
  const { students, week, weekName } = useApp();
  const winners = students.flatMap((student) => student.awards.filter((award) => award.week === week).map((award) => ({ student, award })));
  return <Modal open onClose={onClose} wide>
    <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-grape-800 via-grape-700 to-grape-950 p-5 text-white sm:p-8">
      <div className="flex items-start justify-between"><div><p className="text-sm font-extrabold text-gold-300">{weekName || `الأسبوع ${ar(week)}`}</p><h2 className="mt-1 font-display text-3xl font-extrabold sm:text-5xl">🏆 جوائز الأسبوع</h2><p className="mt-2 text-sm font-bold text-grape-200">نحتفل بالاجتهاد والاستمرار والتنافس الجميل</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"><Icon name="x" className="h-5 w-5" /></button></div>
      {winners.length === 0 ? <div className="mt-10 rounded-3xl border-2 border-dashed border-white/25 p-12 text-center font-display text-xl font-extrabold text-grape-200">لم تُوزّع جوائز هذا الأسبوع بعد</div> : <div className="mt-7 grid gap-4 sm:grid-cols-2">{winners.map(({ student, award }) => <article key={award.id} className="flex items-center gap-4 rounded-3xl border border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur"><Avatar photo={student.photo} name={student.name} size={72} frame={student.frame} crown={student.crown} glow={student.glow}/><div className="min-w-0 flex-1"><h3 className="truncate font-display text-2xl font-extrabold">{student.name}</h3><p className="mt-1 font-bold text-gold-300">{award.title}</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">المستوى {ar(levelInfo(student.xp).level)}</span><span className="flex items-center gap-1 rounded-full bg-gold-400 px-3 py-1 text-xs font-extrabold text-grape-950"><Coin className="h-4 w-4"/>+{ar(award.coins ?? 0)}</span></div></div></article>)}</div>}
    </div>
  </Modal>;
}
