import test from 'node:test';import assert from 'node:assert/strict';
import {seedStudents,emptyWeekDays,emptyRecitationRatings,emptyWeeklyWard,type WeekLog} from '../src/core.ts';
import {studentPeriodMetrics,recordMetrics,statisticsMonths} from '../src/periodStatistics.ts';
import {addCalendarDays,hijriMonthKey,localDateKey,dateFromLocalKey,currentHijriMonthBounds} from '../src/hijriDate.ts';
const student=()=>({...seedStudents()[0],id:'s',name:'طالب',days:emptyWeekDays(),ward:emptyWeeklyWard(),recitationRatings:emptyRecitationRatings()});
function log(s:ReturnType<typeof student>,week:number,start:string):WeekLog{return {week,name:'',savedAt:'',savedAtIso:'2026-10-20T12:00:00Z',weekStartDateIso:start,records:[s],top:[],awards:[]};}
test('ثلاثة أيام حضور في الأسبوع تدخل الشهر نفسه وتطابق المصدر المشترك',()=>{
 const s=student();for(const key of ['sun','mon','tue'] as const)s.days[key].a=true;
 const w=studentPeriodMetrics(s,[],7,'2026-10-18',{kind:'week',week:7});
 const m=studentPeriodMetrics(s,[],7,'2026-10-18',{kind:'month',month:hijriMonthKey(addCalendarDays('2026-10-18',0))});
 assert.equal(w.present,3);assert.equal(m.present,3);assert.deepEqual(w,m);
});
test('أسبوعان في الشهر وتعديل حضور قديم يظهران دون إعادة مكافآت',()=>{
 const s=student(),old=student();s.days.sun.a=true;old.days.mon.a=true;
 const logs=[log(old,6,'2026-10-11')];const scope={kind:'month' as const,month:hijriMonthKey(addCalendarDays('2026-10-18',0))};
 // This particular teaching week crosses a Hijri boundary; ask for each day's actual month.
 const all=studentPeriodMetrics(s,logs,7,'2026-10-18',{kind:'all'});assert.equal(all.present,2);
 logs[0].records![0].days.mon={a:false,h:false,r:false,absent:true};
 const after=studentPeriodMetrics(s,logs,7,'2026-10-18',{kind:'all'});assert.equal(after.present,1);assert.equal(after.absent,1);
});
test('توزيع الأسبوع بين شهرين هجريين حسب كل يوم وإتاحة الشهرين',()=>{
 let start='';for(let i=0;i<365;i++){const d=addCalendarDays('2026-01-01',i);if(d.getUTCDay()===0&&hijriMonthKey(d)!==hijriMonthKey(addCalendarDays(d,3))){start=localDateKey(d);break;}}
 assert(start);const s=student();Object.values(s.days).forEach(d=>d.a=true);
 const keys=statisticsMonths(start,[]).map(([key])=>key);assert.equal(keys.length,2);
 const counts=keys.map(month=>studentPeriodMetrics(s,[],1,start,{kind:'month',month}).present);
 assert.equal(counts.reduce((a,b)=>a+b),4);assert(counts.every(n=>n>0&&n<4));
 const archived=keys.map(month=>studentPeriodMetrics(student(),[log(s,1,start)],2,'2027-01-03',{kind:'month',month}).present);assert.deepEqual(archived,counts);
});
test('غياب صريح وتقييم غير ناجح وبدون تقييم لا تضيف إنجازًا ولو كتب المقدار',()=>{
 const s=student();s.days.sun={a:true,h:true,r:true,absent:true};s.recitationRatings.sun={h:'excellent',r:'excellent'};
 s.days.mon.a=true;s.ward.mon.memorizationLines=60;s.ward.mon.reviewPages=8;
 s.days.tue={a:true,h:true,r:true};s.ward.tue.memorizationLines=30;s.ward.tue.reviewPages=2;
 s.recitationRatings.tue={h:'very-good',r:'excellent'};
 const m=recordMetrics(s);assert.equal(m.present,2);assert.equal(m.absent,1);assert.equal(m.memorizationPages,2);assert.equal(m.reviewPages,2);assert.equal(m.memorizationVeryGood,1);assert.equal(m.reviewExcellent,1);assert.equal(m.notHeardMem,1);
});
test('يوم الاختبار معفى من الحفظ ومكافأة المراجعة فقط مضاعفة',()=>{
 const s=student();s.days.sun={a:true,h:false,r:true,testing:true};s.recitationRatings.sun.r='excellent';
 const m=recordMetrics(s);assert.equal(m.notHeardMem,0);assert.equal(m.reviewSessions,1);assert.equal(m.earnedLearningXp,25);assert.equal(m.earnedLearningCoins,12);
});
test('تكرار الأسبوع والتاريخ والأسبوع الحالي في الأرشيف لا يضاعف الحضور',()=>{
 const s=student();s.days.sun.a=true;const old=student();old.days.mon.a=true;
 const logs=[log(s,7,'2026-10-18'),log(old,6,'2026-10-18'),log(old,6,'2026-10-18')];
 assert.equal(studentPeriodMetrics(s,logs,7,'2026-10-18',{kind:'all'}).present,1);
});
test('آخر نسخة للأسبوع السابق أولى ولا يربط سجلًا باسم طالب آخر',()=>{
 const s=student(),old=student();old.days.sun.a=true;const a=log(old,6,'2026-10-11'),b=structuredClone(a);b.savedAtIso='2026-10-21T12:00:00Z';b.records![0].days.sun.a=false;
 assert.equal(studentPeriodMetrics(s,[a,b],7,'2026-10-18',{kind:'all'}).present,0);
 b.records![0].id='other';b.records![0].days.sun.a=true;assert.equal(studentPeriodMetrics(s,[b],7,'2026-10-18',{kind:'all'}).present,0);
});
test('التاريخ غير المعروف لا يُنسب لشهر الحفظ وتبقى التفاصيل في الإجمالي',()=>{
 const s=student(),old=student();old.days.sun.a=true;const l=log(old,6,'2026-10-11');delete l.weekStartDateIso;
 const monthly=studentPeriodMetrics(s,[l],7,'2026-10-18',{kind:'month',month:hijriMonthKey(new Date())});assert.equal(monthly.present,0);assert.equal(monthly.incompleteHistory,1);
 assert.equal(studentPeriodMetrics(s,[l],7,'2026-10-18',{kind:'all'}).present,1);
});
test('منتصف الليل والشهر ثابتان بتوقيت الرياض لا بتوقيت جهاز الزائر',()=>{
 const instant=new Date('2026-10-20T22:30:00Z');assert.equal(localDateKey(instant),'2026-10-21');
 assert.equal(localDateKey(dateFromLocalKey('2026-10-21')!),'2026-10-21');assert.equal(dateFromLocalKey('2026-02-31'),null);
 const bounds=currentHijriMonthBounds(instant);assert.equal(hijriMonthKey(bounds.start),hijriMonthKey(instant));assert.equal(hijriMonthKey(bounds.end),hijriMonthKey(instant));assert.notEqual(hijriMonthKey(new Date(bounds.end.getTime()+1)),hijriMonthKey(instant));
});
