import test from 'node:test';import assert from 'node:assert/strict';
import {seedStudents,emptyWeekDays,emptyWeeklyWard,emptyRecitationRatings,levelInfo} from '../src/core.ts';
import {mergeAccountingChanges} from '../src/rewardMerge.ts';
function base(){const s={...seedStudents()[0],id:'s',coins:100,xp:100,highestRewardedLevel:levelInfo(100).level,awards:[],days:emptyWeekDays(),ward:emptyWeeklyWard(),recitationRatings:emptyRecitationRatings()};return {week:7,students:[s],weeksLog:[],ceremonyPicks:{}};}
function award(state:any,id:string,coins:number){state.students[0].awards.push({id,title:id,week:7,coins});state.students[0].coins+=coins;}
test('معلمان يمنحان الجائزة نفسها مع تغييرات مستقلة لا يضاعفان العملات',()=>{
 const b=base(),l=structuredClone(b),r=structuredClone(b);award(l,'week-7-s-behavior',7);award(r,'week-7-s-behavior',7);l.students[0].name='اسم جديد';r.students[0].guardianPhone='123';
 const merged=mergeAccountingChanges(b,l,r);assert.equal(merged.students[0].awards.length,1);assert.equal(merged.students[0].coins,107);assert.equal(merged.students[0].name,'اسم جديد');assert.equal(merged.students[0].guardianPhone,'123');
});
test('جائزتان مختلفتان للطالب نفسه من معلمين تجمعان مرة واحدة لكل مصدر',()=>{
 const b=base(),l=structuredClone(b),r=structuredClone(b);award(l,'behavior',7);award(r,'improved',11);
 const m=mergeAccountingChanges(b,l,r);assert.equal(m.students[0].coins,118);assert.equal(m.students[0].awards.length,2);
});
test('إعادة دمج الجائزة المؤكدة لا تعيد منح عملاتها',()=>{
 const b=base(),l=structuredClone(b);award(l,'behavior',7);const once=mergeAccountingChanges(b,l,structuredClone(l));
 assert.equal(mergeAccountingChanges(l,structuredClone(l),once).students[0].coins,107);
});
test('تعديل كشف أسبوع انتهى على جهاز آخر لا ينتقل بصمت إلى الأسبوع الجديد',()=>{
 const b=base(),local=structuredClone(b),remote=structuredClone(b);local.students[0].days.sun.a=true;remote.week=8;
 assert.throws(()=>mergeAccountingChanges(b,local,remote),/الأسبوع/);
});
test('بدء أسبوع جديد لا يسقط تعديل كشف متزامن على الجهاز الآخر',()=>{
 const b=base(),local=structuredClone(b),remote=structuredClone(b);local.week=8;remote.students[0].days.sun.a=true;
 assert.throws(()=>mergeAccountingChanges(b,local,remote),/الأسبوع/);
});
test('تغيير الملف الشخصي المستقل يظل قابلًا للدمج مع أسبوع جديد',()=>{
 const b=base(),l=structuredClone(b),r=structuredClone(b);l.students[0].name='اسم';r.week=8;
 const m=mergeAccountingChanges(b,l,r);assert.equal(m.week,8);assert.equal(m.students[0].name,'اسم');
});
