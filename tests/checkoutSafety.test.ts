import test from "node:test";
import assert from "node:assert/strict";
import { beginPendingCheckout, type PendingCheckout } from "../src/pendingCheckout.ts";
import { CloudWriteQueue } from "../src/cloudWriteQueue.ts";
import { applyCheckoutTransaction } from "../src/checkoutTransaction.ts";
import { seedStudents, type ShopItem } from "../src/core.ts";
import { mergeLocalChanges, sameValue } from "../src/syncMerge.ts";
const operation:PendingCheckout={requestId:'op1',studentId:'s1',purchasedAt:'2026-10-10T00:00:00Z',lines:[{itemId:'p1',qty:1}],allowClosedStore:false};
function storage() { const map=new Map<string,string>();return {getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);}}; }
function state() {
  const s={...seedStudents()[0],id:'s1',coins:10000,coinsSpent:0,bag:[],inventory:[]};
  const p:ShopItem={id:'p1',name:'test',desc:'',price:5,minLevel:1,icon:'gift',kind:'external',repeatable:true,stock:1000};
  return {students:[s],products:[p],orders:[],parentStoreOpen:true,heartPrice:150};
}
test("reload after lost response reuses persisted ID and cannot debit twice",()=>{
  const disk=storage();const first=beginPendingCheckout(disk,'key',operation);
  const result=applyCheckoutTransaction(state(),'s1',first.operation.lines,first.operation.requestId,first.operation.purchasedAt);assert.equal(result.success,true);if(!result.success)return;
  const retry=beginPendingCheckout(disk,'key',{...operation,requestId:'op2'});assert.equal(retry.resumed,true);
  const again=applyCheckoutTransaction(result.state,'s1',retry.operation.lines,retry.operation.requestId,retry.operation.purchasedAt);
  assert.equal(again.success,true);if(!again.success)return;assert.equal(again.alreadyApplied,true);assert.equal(again.state.students[0].coins,9995);assert.equal(again.state.orders.length,1);
});
test("different cart cannot silently replace an ambiguous purchase",()=>{
  const disk=storage();beginPendingCheckout(disk,'key',operation);assert.throws(()=>beginPendingCheckout(disk,'key',{...operation,lines:[{itemId:'p1',qty:2}]}));
});
test("local storage failure aborts before a checkout is sent",()=>{
  const disk={...storage(),setItem:()=>{throw Error('quota');}};assert.throws(()=>beginPendingCheckout(disk,'key',operation),/quota/);
});
test("queue serializes autosave and checkout and survives rejected requests",async()=>{
  const queue=new CloudWriteQueue();const events:string[]=[];
  const tasks=[queue.run(async()=>{events.push('save-start');await new Promise(r=>setTimeout(r,5));events.push('save-end');}),queue.run(async()=>{events.push('checkout');throw Error('offline');}),queue.run(async()=>{events.push('retry');})];
  await Promise.allSettled(tasks);assert.deepEqual(events,['save-start','save-end','checkout','retry']);
});
test("accepting own commit does not apply a submitted balance adjustment twice",()=>{
  const base={coins:100};const submitted={coins:110};const committed={coins:90};
  assert.deepEqual(mergeLocalChanges(submitted,submitted,committed),committed);
  assert.deepEqual(mergeLocalChanges(submitted,{coins:115},committed),{coins:95});
  assert.equal(sameValue({photo:'data:image/png;base64,'+'a'.repeat(100000)},{photo:'data:image/png;base64,'+'a'.repeat(100000)}),true);
});
test("invalid financial values and duplicate cosmetic quantities never mutate balances",()=>{
  for(const invalid of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    const s=state();s.products[0].price=invalid;const before=structuredClone(s);
    assert.equal(applyCheckoutTransaction(s,'s1',operation.lines,'id',operation.purchasedAt).success,false);assert.deepEqual(s,before);
  }
  const s=state();s.products[0].kind='cosmetic';assert.equal(applyCheckoutTransaction(s,'s1',[{itemId:'p1',qty:2}],'id',operation.purchasedAt).success,false);
});
test("request ID cannot be replayed for a different student or quantity",()=>{
  const initial=state();const first=applyCheckoutTransaction(initial,'s1',operation.lines,'id',operation.purchasedAt);assert.equal(first.success,true);if(!first.success)return;
  assert.equal(applyCheckoutTransaction(first.state,'s2',operation.lines,'id',operation.purchasedAt).success,false);
  assert.equal(applyCheckoutTransaction(first.state,'s1',[{itemId:'p1',qty:2}],'id',operation.purchasedAt).success,false);
});
for(const count of [1,10,20,50,100]) test(`${count} purchases preserve coins, stock, orders and bags; retries are idempotent`,()=>{
  let current=state();const original=current;const initial=structuredClone(current);
  for(let i=0;i<count;i++) {
    const result=applyCheckoutTransaction(current,'s1',operation.lines,'op'+i,operation.purchasedAt);
    assert.equal(result.success,true);if(!result.success)return;current=result.state;
    const replay=applyCheckoutTransaction(current,'s1',operation.lines,'op'+i,operation.purchasedAt);assert.equal(replay.success,true);if(!replay.success)return;assert.equal(replay.state,current);
  }
  assert.equal(current.students[0].coins,10000-5*count);assert.equal(current.products[0].stock,1000-count);assert.equal(current.orders.length,count);assert.deepEqual(original,initial);
});
