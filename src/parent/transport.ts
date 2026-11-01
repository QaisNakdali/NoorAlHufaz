import { normalizeRecord } from "./normalize";
import { createClient } from "@supabase/supabase-js";
import type { ParentResponse, ParentSection } from "./types";
const URL = import.meta.env.VITE_SUPABASE_URL || "https://inkxxpomafiwygzhohwr.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlua3h4cG9tYWZpd3lnemhvaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5Mjc5MzcsImV4cCI6MjEwNTUwMzkzN30.9F1VB43lKUFWRQqDlOFdZWN9Qi3wnap17Z3JNZ8trxY";
const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export async function rpc(name:string, args:Record<string,unknown>, signal?:AbortSignal):Promise<ParentResponse> {
  const response=await fetch(URL+"/rest/v1/rpc/"+name,{method:"POST",cache:"no-store",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify(args),signal});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.code==="PGRST202"?"لم تُفعّل واجهة بيانات البوابة الجديدة على الخادم بعد":data?.message||"تعذر الاتصال بالخادم");
  if(!data || data.error)throw new Error(data?.error||"رد غير صالح من الخادم");
  if(data.overview?.student)data.overview.student=normalizeRecord(data.overview.student);
  if(Array.isArray(data.logs))data.logs=data.logs.map((log:any)=>({...log,records:log.records?.map(normalizeRecord)}));
  return data;
}
export const readParent=(token:string,section:ParentSection,options:Record<string,unknown>={},signal?:AbortSignal)=>rpc("noor_parent_read",{p_token:token,p_section:section,p_options:options},signal);
export function subscribeParent(topic:string,onVersion:(message?:{rev:number;base?:string;next?:string;paths?:string[][];catalog?:boolean;archive?:boolean})=>void,onConnection:(connected:boolean)=>void) {
  const channel=client.channel(topic,{config:{private:false}}).on("broadcast",{event:"version"},({payload})=>onVersion(payload)).subscribe(status=>{
    if(status==="SUBSCRIBED"){onConnection(true);onVersion();}
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")onConnection(false);
  });
  return ()=>{void client.removeChannel(channel);};
}
