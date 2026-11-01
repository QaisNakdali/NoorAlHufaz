import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { applyLiveDelta } from "../liveDelta";
import { beginPendingCheckout } from "../pendingCheckout";
import type { ParentOverview, ParentResponse, ParentSection, Versions } from "./types";
import { readParent, rpc, subscribeParent } from "./transport";

type Connection = "loading"|"ready"|"checking"|"offline"|"invalid";
type Cached = { version:string; data:ParentResponse };
type ContextValue = { overview:ParentOverview|null; status:Connection; error:string; confirmedAt:number|null; revision:number; load:(section:ParentSection,options?:Record<string,unknown>)=>Promise<ParentResponse>; buy:(id:string)=>Promise<{success:boolean;error?:string}>; equip:(id:string)=>Promise<{success:boolean;error?:string}>; refresh:()=>void; sectionVersion:(section:ParentSection)=>string };
const Context=createContext<ContextValue|null>(null);
const bucket=(s:ParentSection):keyof Versions => s==="archive"||s==="statistics"||s==="calendar"?"archive":s==="catalog"?"catalog":s==="purchases"?"purchases":"overview";
export function ParentProvider({token,children}:{token:string;children:ReactNode}) {
  const [overview,setOverview]=useState<ParentOverview|null>(null),[status,setStatus]=useState<Connection>("loading"),[error,setError]=useState(""),[confirmedAt,setConfirmedAt]=useState<number|null>(null),[revision,setRevision]=useState(0),[versionTick,setVersionTick]=useState(0),[topic,setTopic]=useState("");
  const snapshot=useRef<ParentOverview|null>(null), deferredRevision=useRef(0);
  const versions=useRef<Versions>({overview:"",archive:"",catalog:"",purchases:""}),rev=useRef(0),cache=useRef(new Map<string,Cached>()),inFlight=useRef(new Map<string,Promise<ParentResponse>>()),mounted=useRef(true),controller=useRef(new AbortController()),busy=useRef(false),logDone=useRef(false),loggedStore=useRef(false),check=useRef<Promise<void>|null>(null),retryMs=useRef(1000),retryTimer=useRef<ReturnType<typeof setTimeout>>(),queueTimer=useRef<ReturnType<typeof setTimeout>>();
  const accept=useCallback((response:ParentResponse)=>{
    if(!mounted.current||response.rev<rev.current)return;
    rev.current=response.rev;setRevision(response.rev);
    if(response.versions){const changed=JSON.stringify(versions.current)!==JSON.stringify(response.versions);versions.current=response.versions;if(changed)setVersionTick(n=>n+1);}
    if(response.overview){snapshot.current=response.overview;setOverview(response.overview);}
    if(response.topic)setTopic(response.topic);
    setError("");setStatus("ready");setConfirmedAt(Date.now());retryMs.current=1000;
  },[]);
  const reportError=useCallback((e:unknown)=>{
    if(!mounted.current||(e instanceof DOMException&&e.name==="AbortError"))return;
    const message=e instanceof Error?e.message:"تعذر تحديث البيانات";setError(message);setStatus(message.includes("رابط")?"invalid":"offline");if(message.includes("رابط")){setOverview(null);snapshot.current=null;cache.current.clear();setTopic("");}
  },[]);
  const load=useCallback(async(section:ParentSection,options:Record<string,unknown>={})=>{
    const key=section+":"+JSON.stringify(options), version=versions.current[bucket(section)],stored=cache.current.get(key);
    if(stored&&stored.version===version)return stored.data;
    const existing=inFlight.current.get(key);if(existing)return existing;
    const request=(async()=>{let data=await readParent(token,section,options,controller.current.signal);for(let retry=0;retry<2&&data.rev<rev.current&&data.versions[bucket(section)]!==versions.current[bucket(section)];retry++)data=await readParent(token,section,options,controller.current.signal);if(data.rev<rev.current&&data.versions[bucket(section)]!==versions.current[bucket(section)])throw new Error("وصلت نسخة أقدم أثناء التحديث؛ أعد المحاولة");return data;})().then(data=>{
      // Never label an older response as the newest version. A concurrent change invalidates it.
      if(data.rev>=rev.current)accept(data);if(data.versions[bucket(section)]===versions.current[bucket(section)]){cache.current.set(key,{version:data.versions[bucket(section)],data});while(cache.current.size>12)cache.current.delete(cache.current.keys().next().value!);}
      return data;
    }).catch(e=>{reportError(e);throw e;}).finally(()=>{inFlight.current.delete(key);});
    if(section==="catalog"&&!loggedStore.current){loggedStore.current=true;void rpc("noor_parent_action",{p_token:token,p_action:"access",p_args:{store:true}}).catch(()=>{loggedStore.current=false;});}
    inFlight.current.set(key,request);return request;
  },[token,accept,reportError]);
  const refresh:()=>void=useCallback(()=>{
    if(check.current||!mounted.current)return;
    check.current=(async()=>{
      try{
        const response=await readParent(token,"status",{},controller.current.signal);
        if(response.versions.overview!==versions.current.overview){const data=await readParent(token,"overview",{},controller.current.signal);accept(data);}else accept(response);
      }catch(e){reportError(e);if(mounted.current&&!(e instanceof Error&&e.message.includes("رابط"))){retryTimer.current=setTimeout(refresh,retryMs.current);retryMs.current=Math.min(30000,retryMs.current*2);}}
      finally{check.current=null;}
    })();
  },[token,accept,reportError]);
  useEffect(()=>{
    mounted.current=true;controller.current=new AbortController();
    void readParent(token,"overview",{},controller.current.signal).then(accept).catch(reportError);
    const offline=()=>{setStatus("offline");setError("انقطع الاتصال. المعروض آخر نسخة مؤكدة؛ ستتحدث البيانات عند عودة الشبكة.");};
    const online=()=>{setStatus("checking");refresh();},visible=()=>{if(document.visibilityState==="visible")online();};
    window.addEventListener("online",online);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",visible);
    const timer=setInterval(()=>{if(document.visibilityState!=="hidden"&&navigator.onLine)refresh();},60000);
    return()=>{mounted.current=false;controller.current.abort();clearInterval(timer);clearTimeout(retryTimer.current);clearTimeout(queueTimer.current);window.removeEventListener("online",online);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",visible);};
  },[token,accept,reportError,refresh]);
  useEffect(()=>{
    if(!topic)return;
    return subscribeParent(topic,message=>{
      if(!message){refresh();return;}
      if(!Number.isSafeInteger(message.rev)||message.rev<=rev.current)return;
      if(busy.current){deferredRevision.current=Math.max(deferredRevision.current,message.rev);return;}
      if(message.catalog){versions.current={...versions.current,catalog:"invalid:"+message.rev};setVersionTick(n=>n+1);}
      if(message.archive){versions.current={...versions.current,archive:"invalid:"+message.rev,purchases:"invalid:"+message.rev};setVersionTick(n=>n+1);}
      if(!message.next||message.next===versions.current.overview)return;
      clearTimeout(queueTimer.current);queueTimer.current=setTimeout(()=>{
        if(snapshot.current&&message.base===versions.current.overview&&Array.isArray(message.paths)){
          void readParent(token,"delta",{paths:message.paths,expected:message.next,base:message.base},controller.current.signal).then(response=>{
            if(response.overview){accept(response);return;}
            if(response.delta&&snapshot.current&&versions.current.overview===response.delta.base){
              const applied=applyLiveDelta({rev:0,data:snapshot.current},{baseRev:0,rev:1,patch:response.delta.changes});
              if(applied){accept({...response,overview:applied.data as ParentOverview});return;}
            }
            refresh();
          }).catch(reportError);
        }else refresh();
      },80);
    },connected=>{if(mounted.current&&!connected){setStatus("offline");setError("انقطع التحديث المباشر؛ جارٍ إعادة الاتصال. البيانات المعروضة آخر نسخة مؤكدة.");}});
  },[topic,token,refresh,accept,reportError]);
  useEffect(()=>{
    if(!overview||logDone.current)return;logDone.current=true;
    void rpc("noor_parent_action",{p_token:token,p_action:"access",p_args:{store:false}}).catch(()=>{logDone.current=false;});
  },[overview?.student.id,token]);
  const buy=useCallback(async(id:string)=>{
    if(busy.current)return {success:false,error:"انتظر تأكيد العملية الحالية"};
    if(!overview)return {success:false,error:"لم تكتمل قراءة بيانات الطالب"};busy.current=true;
    try{
      const key="noor-parent-pending:"+topic;
      const {operation}=beginPendingCheckout(sessionStorage,key,{requestId:crypto.randomUUID(),purchasedAt:new Date().toISOString(),studentId:overview.student.id,lines:[{itemId:id,qty:1}],allowClosedStore:false});
      let response=await rpc("noor_parent_action",{p_token:token,p_action:"checkout",p_args:{requestId:operation.requestId,lines:operation.lines,expected:versions.current.overview}});
      if(!response.success||response.requestId!==operation.requestId)throw new Error(response.error||"لم يتأكد حفظ عملية الشراء؛ أعد محاولة المنتج نفسه");
      const committedCatalog=response.versions.catalog;
      if(response.delta){
        const applied=snapshot.current&&versions.current.overview===response.delta.base?applyLiveDelta({rev:0,data:snapshot.current},{baseRev:0,rev:1,patch:response.delta.changes}):null;
        response=applied?{...response,overview:applied.data as ParentOverview}:{...response,...await readParent(token,"overview",{},controller.current.signal)};
      }
      const current=cache.current.get("catalog:{}");
      if(current&&current.version===response.baseCatalog&&response.versions.catalog===committedCatalog){const changes=response.changedProducts??[];current.data={...current.data,products:current.data.products?.map(p=>({...p,...changes.find(c=>c.id===p.id)}))};current.version=response.versions.catalog;}
      accept(response);sessionStorage.removeItem(key);return {success:true};
    }catch(e){return {success:false,error:e instanceof Error?e.message:"لم يتأكد الحفظ؛ أعد محاولة المنتج نفسه دون بدء عملية مختلفة"};}
    finally{busy.current=false;if(deferredRevision.current>rev.current)refresh();deferredRevision.current=0;}
  },[token,topic,overview,accept,refresh]);
  const equip=useCallback(async(id:string)=>{
    if(busy.current)return {success:false,error:"انتظر تأكيد العملية الحالية"};busy.current=true;
    try{const response=await rpc("noor_parent_action",{p_token:token,p_action:"equip",p_args:{itemId:id}});if(!response.success)throw new Error(response.error||"لم يتأكد التفعيل");accept(response);return {success:true};}catch(e){return {success:false,error:e instanceof Error?e.message:"تعذر التفعيل"};}finally{busy.current=false;if(deferredRevision.current>rev.current)refresh();deferredRevision.current=0;}
  },[token,accept,refresh]);
  const sectionVersion=useCallback((s:ParentSection)=>versions.current[bucket(s)],[versionTick]);
  // The only persisted browser value is an idempotency key, never central student data.
  return <Context.Provider value={{overview,status,error,confirmedAt,revision,load,buy,equip,refresh,sectionVersion}}>{children}</Context.Provider>;
}
export function useParent(){const value=useContext(Context);if(!value)throw new Error("Missing parent data provider");return value;}
export function useParentSection(section:ParentSection,options:Record<string,unknown>={},enabled=true){
  const {load,sectionVersion}=useParent(),version=sectionVersion(section),key=JSON.stringify(options),[data,setData]=useState<ParentResponse|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  useEffect(()=>{if(!enabled)return;let active=true;setLoading(true);setError("");void load(section,JSON.parse(key)).then(response=>{if(active)setData(response);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[load,section,key,version,enabled]);
  return {data,loading,error};
}
