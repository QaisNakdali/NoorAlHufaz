import test from 'node:test';import assert from 'node:assert/strict';
import {seedStudents,emptyWeekDays,emptyWeeklyWard,emptyRecitationRatings,denseStudentRanking,type CeremonyPicks,type WeekLog} from '../src/core.ts';
import {ceremonyWinners,updateCeremonyWinner} from '../src/ceremonySelection.ts';
import {improvementCandidates,excellenceSnapshot} from '../src/improvementCandidates.ts';
import {mergeAccountingChanges} from '../src/rewardMerge.ts';
const students=()=>['a','b','c','d'].map((id,i)=>({...seedStudents()[0],id,name:id,halaqaId:i===3?'h2':'h1',days:emptyWeekDays(),ward:emptyWeeklyWard(),recitationRatings:emptyRecitationRatings()}));
test('صفر أو واحد أو طالبان لكل حلقة وجائزة مع دعم الاختيار القديم',()=>{
 const ss=students();let p:CeremonyPicks={behavior:'a'};assert.deepEqual(ceremonyWinners(p,'behavior','h1',ss),['a']);
 p=updateCeremonyWinner(p,'behavior','h1','b',1,ss);assert.deepEqual(ceremonyWinners(p,'behavior','h1',ss),['a','b']);
 p=updateCeremonyWinner(p,'behavior','h1',null,0,ss);assert.deepEqual(ceremonyWinners(p,'behavior','h1',ss),['b']);
 p=updateCeremonyWinner(p,'behavior','h1',null,0,ss);assert.deepEqual(ceremonyWinners(p,'behavior','h1',ss),[]);
 p=updateCeremonyWinner(p,'improved','h2','d',0,ss);assert.deepEqual(ceremonyWinners(p,'improved','h2',ss),['d']);assert.deepEqual(ceremonyWinners(p,'behavior','h1',ss),[]);
});
test('لا يتكرر فائز ولا يعبر الحلقة ولا تمس الاختيارات جوائز الطالب السابقة',()=>{
 const ss=students();ss[0].awards=[{id:'prior',week:1,title:'قديم'}];const before=structuredClone(ss);
 let p=updateCeremonyWinner({},'improved','h1','a',0,ss);p=updateCeremonyWinner(p,'improved','h1','a',1,ss);assert.equal(ceremonyWinners(p,'improved','h1',ss).length,1);
 assert.throws(()=>updateCeremonyWinner(p,'improved','h1','d',1,ss));assert.deepEqual(ss,before);
});
function fill(s:ReturnType<typeof students>[number],h:number,r:number){for(let i=0;i<4;i++){const key=(['sun','mon','tue','wed'] as const)[i];s.days[key].a=true;if(i<h){s.days[key].h=true;s.recitationRatings[key].h='excellent';}if(i<r){s.days[key].r=true;s.recitationRatings[key].r='excellent';}}}
test('ترشيح التحسن الحقيقي بمقارنة ممتاز حفظ ومراجعة الطالب بنفسه',()=>{
 const ss=students(),old=students();fill(old[0],1,2);fill(ss[0],3,4);fill(old[1],4,4);fill(ss[1],4,4);
 const logs=[{week:6,records:old,top:[],awards:[],savedAt:'',name:''} as WeekLog];const copy=structuredClone(ss);
 const result=improvementCandidates(ss,logs,7);assert.equal(result[0].student.id,'a');assert.equal(result[0].delta,4);assert.equal(result[0].past?.h,1);assert.equal(result[0].current.r,4);assert.equal(result.find(x=>x.student.id==='b')?.eligible,false);assert.deepEqual(ss,copy);
 // Any student, including one outside recommendations, is still selectable.
 assert.deepEqual(ceremonyWinners(updateCeremonyWinner({},'improved','h1','b',0,ss),'improved','h1',ss),['b']);
});
test('طالب جديد وأسبوع سابق مفقود وتحليل مبدئي لا يولدان فائزًا تلقائيًا',()=>{
 const ss=students();fill(ss[0],4,4);const rows=improvementCandidates(ss,[],7);assert(rows.every(r=>!r.eligible&&r.delta===null));assert(rows.some(r=>r.preliminary));
 const logs=[{week:5,records:students(),top:[],awards:[],savedAt:'',name:''} as WeekLog];assert(improvementCandidates(ss,logs,7).every(r=>r.past===null));
});
test('تصحيح الفرص يمنع ترشيح زيادة العدد الناتجة فقط عن زيادة أيام الحضور ويحترم الاختبار',()=>{
 const ss=students(),old=students();fill(ss[0],2,2);fill(old[0],1,1);for(const k of ['mon','tue','wed'] as const)old[0].days[k].a=false;
 const l={week:6,records:old,top:[],awards:[],savedAt:'',name:''} as WeekLog;assert.equal(improvementCandidates(ss,[l],7).find(r=>r.student.id==='a')?.eligible,false);
 const s=ss[1];s.days.sun={a:true,h:false,r:true,testing:true};s.recitationRatings.sun.r='excellent';assert.deepEqual(excellenceSnapshot(s),{h:0,r:1,total:1,opportunities:1,evaluatedDays:1,rate:1});
});
test('ترتيب كثيف للمستوى والنقاط أو الرصيد المتاح ويتحدث بعد الشراء',()=>{
 const ss=students();ss[0].xp=500;ss[1].xp=500;ss[2].xp=300;ss[3].xp=0;ss[0].coins=20;ss[1].coins=80;ss[2].coins=80;ss[3].coins=0;
 assert.deepEqual(denseStudentRanking(ss).map(r=>r.rank),[1,1,2,3]);
 assert.deepEqual(denseStudentRanking(ss,'coins').map(r=>[r.student.id,r.rank]),[['b',1],['c',1],['a',2],['d',3]]);
 ss[1].coins-=70;assert.equal(denseStudentRanking(ss,'coins')[0].student.id,'c');
 assert.equal(denseStudentRanking(ss.filter(s=>s.halaqaId==='h2'),'coins')[0].rank,1);
});
test('اختيارات متزامنة لحلقات مختلفة تندمج والاختيارات المتعارضة لا تستبدل بصمت',()=>{
 const base={students:[],ceremonyPicks:{improvedByHalaqa:{h1:[],h2:[]}}},local=structuredClone(base) as any,remote=structuredClone(base) as any;
 local.ceremonyPicks.improvedByHalaqa.h1=['a'];remote.ceremonyPicks.improvedByHalaqa.h2=['d'];
 assert.deepEqual(mergeAccountingChanges(base,local,remote).ceremonyPicks.improvedByHalaqa,{h1:['a'],h2:['d']});
 remote.ceremonyPicks.improvedByHalaqa.h1=['b','c'];assert.throws(()=>mergeAccountingChanges(base,local,remote),/تعارض|تغيّر/);
});
