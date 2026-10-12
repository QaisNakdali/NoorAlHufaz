import test from 'node:test';import assert from 'node:assert/strict';
import {applyArchiveAdjustment,archiveCloudPayload,mergeArchiveEdit} from '../src/archiveAdjustment.ts';
import {measureStudentWork,analyzeStudent} from '../src/analytics.ts';
import {emptyWeekDays,emptyWeeklyWard,emptyRecitationRatings,seedStudents,RECITE_XP,RECITE_COINS,weekXpOf,calculateStudentTotals,type WeekLog,type Student} from '../src/core.ts';
import {getTotalVersesMemorized,analyzeMemorizationPeriod,isChampionEligible,DAYS} from '../src/core.ts';
function fixture(){
 const student:Student={...seedStudents()[0],id:'s',name:'test',xp:200,coins:50,highestRewardedLevel:10,coinsSpent:25,manualCoinsAdjust:7,manualXpAdjust:9,days:emptyWeekDays(),awards:[{id:'old-award',title:'award',week:1,coins:20}],bag:[{itemId:'p',qty:1,delivered:true}]};
 const record={id:'s',name:'test',photo:null,days:emptyWeekDays(),recitationRatings:emptyRecitationRatings(),ward:emptyWeeklyWard(),hearts:3,heartsLostWeek:0,xp:100,coins:10};
 record.days.sun.a=true;record.ward.sun.memorizationLines=30;record.ward.sun.memorizationVerses=10;record.ward.sun.reviewPages=3;
 const week:WeekLog={week:1,name:'old',savedAt:'old',records:[record],top:[],students:[],awards:[{title:'champion',studentName:'test',coins:20}]};
 return {students:[student],weeksLog:[week],week:5,orders:[{id:'order',price:25}]};
}
function edit(base:WeekLog,part:'h'|'r',on:boolean){const next=structuredClone(base);next.records![0].days.sun[part]=on;next.records![0].recitationRatings.sun[part]=on?'excellent':undefined;return next;}
test('written quantities, missing ratings and stale successful ratings never count as completed',()=>{
 const s=fixture().weeksLog[0].records![0] as Student;
 assert.equal(measureStudentWork(s,'memorization').pages,0);
 s.days.sun.h=true;assert.equal(measureStudentWork(s,'memorization').pages,0);
 s.recitationRatings.sun.h='excellent';assert.equal(measureStudentWork(s,'memorization').pages,2);
 s.days.sun.h=false;assert.equal(measureStudentWork(s,'memorization').pages,0);assert.equal(s.ward.sun.memorizationLines,30);
 s.recitationRatings.sun.h='very-good';s.days.sun.h=true;s.ward.sun.memorizationLines=45;assert.equal(measureStudentWork(s,'memorization').pages,3);
 assert.equal(measureStudentWork(s,'review').pages,0);
});
test('old week adds and reverses exactly one entitlement, retaining purchases, awards and manual values',()=>{
 const original=fixture(),base=original.weeksLog[0],draft=edit(base,'h',true);
 const added=applyArchiveAdjustment(original,1,draft,base);
 assert.equal(added.students[0].xp,200+RECITE_XP);assert.equal(added.students[0].coins,50+RECITE_COINS);
 assert.deepEqual(added.orders,original.orders);assert.deepEqual(added.students[0].bag,original.students[0].bag);assert.deepEqual(added.students[0].awards,original.students[0].awards);
 assert.equal(added.students[0].coinsSpent,25);assert.equal(added.students[0].manualCoinsAdjust,7);assert.equal(added.students[0].manualXpAdjust,9);assert.deepEqual(added.students[0].days,original.students[0].days);
 assert.deepEqual(added.weeksLog[0].awards,base.awards);
 for(let i=0;i<100;i++)assert.deepEqual(applyArchiveAdjustment(added,1,draft,base),added);
 const removed=applyArchiveAdjustment(added,1,edit(added.weeksLog[0],'h',false),added.weeksLog[0]);
 assert.equal(removed.students[0].coins,50);assert.equal(removed.students[0].xp,200);
});
test('successful rating and quantity changes update stats without duplicate reward',()=>{
 let current=fixture();let base=current.weeksLog[0];current=applyArchiveAdjustment(current,1,edit(base,'h',true),base);
 base=current.weeksLog[0];const draft=structuredClone(base);draft.records![0].recitationRatings.sun.h='very-good';draft.records![0].ward.sun.memorizationLines=60;
 const changed=applyArchiveAdjustment(current,1,draft,base);assert.equal(changed.students[0].coins,current.students[0].coins);assert.equal(changed.weeksLog[0].students![0].memorizationPages,4);
});
test('exam review doubles only learning rewards and never awards exempt memorization',()=>{
 const current=fixture(),base=current.weeksLog[0];base.records![0].days.sun.testing=true;
 const next=applyArchiveAdjustment(current,1,edit(base,'r',true),base);
 assert.equal(next.students[0].coins,50+2*RECITE_COINS);assert.equal(next.students[0].xp,200+2*RECITE_XP);
 assert.equal(next.weeksLog[0].students![0].memorizationPages,0);assert.equal(next.weeksLog[0].students![0].reviewPages,3);
});
test('spent reward reversal is rejected atomically rather than erased or clamped',()=>{
 const current=fixture(),base=current.weeksLog[0];base.records![0].days.sun.r=true;base.records![0].recitationRatings.sun.r='excellent';current.students[0].coins=0;
 const before=structuredClone(current);assert.throws(()=>applyArchiveAdjustment(current,1,edit(base,'r',false),base),/لا يكفي/);assert.deepEqual(current,before);
});
test('concurrent teachers same edit grant once; disjoint edits both survive; conflicts are explicit',()=>{
 const current=fixture(),base=current.weeksLog[0],a=edit(base,'h',true),b=edit(base,'r',true);
 const afterA=applyArchiveAdjustment(current,1,a,base);const afterB=applyArchiveAdjustment(afterA,1,b,base);
 assert.equal(afterB.students[0].coins,50+2*RECITE_COINS);
 assert.deepEqual(applyArchiveAdjustment(afterB,1,b,base),afterB);
 assert.throws(()=>mergeArchiveEdit({pages:1},{pages:2},{pages:3}),/معلم آخر/);
 assert.deepEqual(mergeArchiveEdit({pages:1},{pages:2},{pages:2}),{pages:2});
});
test('historical snapshot summary cannot override corrected record amounts in analysis',()=>{
 const current=fixture();current.weeksLog[0].students=[{id:'s',name:'test',xp:1,coins:1,level:1,hearts:3,memorizationPages:100,memorizationLines:1500}];
 const result=analyzeStudent(current.students[0],current.weeksLog);assert.equal(result.cumulativeMemorizationPages,0);assert.equal(result.previousPages,0);
});
test('level bonuses are retained through XP correction and cannot be earned twice',()=>{
 const s=fixture().students[0];const high=calculateStudentTotals(s);s.days.sun.h=true;const next=calculateStudentTotals(s);assert.equal(next.highestRewardedLevel,10);assert.equal(next.coins-high.coins,RECITE_COINS);
});
test('deleting only a successful evaluation reverses its reward and retains the planned amount',()=>{
 const state=fixture(),base=state.weeksLog[0];let current=applyArchiveAdjustment(state,1,edit(base,'h',true),base);
 const before=current.weeksLog[0],draft=structuredClone(before);delete draft.records![0].recitationRatings.sun.h;
 current=applyArchiveAdjustment(current,1,draft,before);assert.equal(current.students[0].coins,50);assert.equal(current.weeksLog[0].records![0].ward.sun.memorizationLines,30);assert.equal(current.weeksLog[0].records![0].days.sun.h,false);
});
test('failed detailed memorization attempts are excluded from verses and period quantities',()=>{
 const student=fixture().students[0];student.memorizationRecords=[{id:'fail',studentId:'s',surahName:'test',fromVerse:1,toVerse:10,versesCount:10,date:'2026-09-01',createdAt:1,success:false},{id:'pass',studentId:'s',surahName:'test',fromVerse:11,toVerse:15,versesCount:5,date:'2026-09-02',createdAt:2,success:true}];
 assert.equal(getTotalVersesMemorized(student),5);const totals=analyzeMemorizationPeriod(student.memorizationRecords,new Date('2026-09-01'),new Date('2026-09-30'));assert.equal(totals.totalVerses,5);assert.equal(totals.failedSessions,1);
});
test('line estimates are added per successful day rather than lost when another day has explicit lines',()=>{
 const s=fixture().weeksLog[0].records![0] as Student;s.days.sun.h=true;s.recitationRatings.sun.h='excellent';s.days.mon.h=true;s.recitationRatings.mon.h='very-good';s.ward.mon.memorizationVerses=10;
 const work=measureStudentWork(s,'memorization');assert.equal(work.lines,45);assert.equal(measureStudentWork(s,'memorization',['mon']).lines,15);
});
test('repeated week numbers and unresolved student identifiers stop financial corrections',()=>{
 const state=fixture(),base=state.weeksLog[0];state.weeksLog.push(structuredClone(base));assert.throws(()=>applyArchiveAdjustment(state,1,edit(base,'h',true),base),/مكرر/);
 const other=fixture(),original=other.weeksLog[0];original.records![0].id='unresolved';assert.throws(()=>applyArchiveAdjustment(other,1,edit(original,'h',true),original),/المعرّف/);
});
test('champion eligibility requires explicit successful grades; historical awards are retained',()=>{
 const state=fixture(),s=state.students[0];s.recitationRatings=emptyRecitationRatings();for(const d of DAYS)s.days[d.key]={a:true,h:true,r:true};
 assert.equal(isChampionEligible(s,false,[]),false);for(const d of DAYS)s.recitationRatings[d.key]={h:'excellent',r:'excellent'};assert.equal(isChampionEligible(s,false,[]),true);
 s.days.mon={a:true,h:false,r:true,testing:true};s.recitationRatings.mon.r='very-good';assert.equal(isChampionEligible(s,false,[],'mixed'),true);assert.equal(isChampionEligible(s,false,[],'excellent'),false);
 assert.equal(s.awards[0].id,'old-award');
});
test('archive cloud payload preserves unknown legacy fields and transmits only the edit',()=>{
 const raw={students:[{id:'s',coins:50,privateLegacyNote:'preserve'}],archiveLegacy:'preserve',weeksLog:[{records:[{id:'s',legacyDetail:{keep:true},days:{sun:{h:false}}}]}]};
 const normalized={students:[{id:'s',coins:50}],weeksLog:[{records:[{id:'s',days:{sun:{h:false}}}]}]};
 const edited=structuredClone(normalized);edited.students[0].coins=55;edited.weeksLog[0].records[0].days.sun.h=true;
 const result=archiveCloudPayload(raw,normalized,edited) as typeof raw;
 assert.equal(result.students[0].coins,55);assert.equal(result.students[0].privateLegacyNote,'preserve');assert.equal(result.archiveLegacy,'preserve');assert.deepEqual(result.weeksLog[0].records[0].legacyDetail,{keep:true});
});
