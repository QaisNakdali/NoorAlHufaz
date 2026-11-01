import assert from 'node:assert/strict';
import test from 'node:test';
import {seedStudents} from '../src/core.ts';
import {studentSchedule,learningState,wardQuantity} from '../src/parent/schedule.ts';
function student(){return {...seedStudents()[0],isTesting:false,days:{sun:{a:false,h:false,r:false},mon:{a:false,h:false,r:false},tue:{a:false,h:false,r:false},wed:{a:false,h:false,r:false}},ward:{mon:{memorization:'النازعات',review:'الفجر'}},recitationRatings:{}};}
const now=new Date('2026-11-01T12:00:00+03:00');
test('ورد الغد يظهر دون حضور أو تقييم',()=>{const s=student(),result=studentSchedule(s,'2026-11-01',now);assert.equal(result.upcoming?.ward?.memorization,'النازعات');assert.equal(result.upcoming?.attendance,'pending');assert.equal(result.upcoming?.memorization,'pending');assert.equal(result.isTomorrow,true);});
test('الورد المعدل يعكس المصدر الحالي دون نسخه',()=>{const s=student();s.ward.mon.memorization='النبأ';assert.equal(studentSchedule(s,'2026-11-01',now).upcoming?.ward?.memorization,'النبأ');});
test('الأسبوع السابق لا يصبح وردا قادما',()=>{assert.equal(studentSchedule(student(),'2026-10-25',now).upcoming,null);assert.equal(studentSchedule(student(),'2026-10-25',now).today,null);});
test('الغد الدراسي الخالي لا يستبدل بيوم بعده',()=>{const s=student();s.ward={tue:{memorization:'عبس',review:''}};const next=studentSchedule(s,'2026-11-01',now);assert.equal(next.upcoming?.key,'mon');assert.equal(next.hasUpcomingPlan,false);});
test('العطلة تعرض أقرب ورد مستقبلي من الأسبوع الجديد فقط',()=>{const result=studentSchedule(student(),'2026-11-08',new Date('2026-11-05T12:00:00+03:00'));assert.equal(result.upcoming?.key,'mon');assert.equal(result.isTomorrow,false);});
test('غياب التقييم لا يساوي فشلا صريحا',()=>{const s=student();assert.equal(learningState(s,'sun','h',false),'pending');s.days.sun.evaluated={h:true};assert.equal(learningState(s,'sun','h',false),'not-completed');assert.equal(learningState(s,'sun','r',false),'pending');});
test('الإنجاز يحتاج العلم والتقييم الناجح',()=>{const s=student();s.days.sun.h=true;assert.equal(learningState(s,'sun','h',false),'pending');s.recitationRatings={sun:{h:'very-good'}};assert.equal(learningState(s,'sun','h',false),'very-good');s.days.sun.absent=true;assert.equal(learningState(s,'sun','h',false),'absent');});
test('اختبار الحفظ لا يعفي المراجعة ولا يغير الماضي',()=>{const s=student();s.isTesting=true;assert.equal(learningState(s,'mon','h',true),'exempt');assert.equal(learningState(s,'mon','r',true),'pending');assert.equal(learningState(s,'sun','h',false),'pending');s.days.sun.testing=true;assert.equal(learningState(s,'sun','h',false),'exempt');});
test('بداية أسبوع مجهولة لا تنسب الورد لتاريخ مخترع',()=>{assert.deepEqual(studentSchedule(student(),'2026-11-02',now).days,[]);assert.deepEqual(studentSchedule(student(),'',now).days,[]);});
test('الكمية لا تكرر الأسطر المشتقة عند وجود صفحات',()=>{assert.equal(wardQuantity({memorization:'',review:'',reviewPages:2,reviewLines:30},'r'),'2 صفحة');});
