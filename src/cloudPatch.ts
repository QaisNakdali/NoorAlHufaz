import { sameValue } from './syncMerge.ts';
export type CloudPatch = { op: "set" | "remove" | "insert"; path: string[]; value?: unknown };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Delta against the exact revision: untouched students, images and history never travel. */
export function buildCloudPatch(before: unknown, after: unknown): CloudPatch[] {
  const ops: CloudPatch[] = [];
  const visit = (a: unknown, b: unknown, path: string[]) => {
    if (a === b) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      const extra = b.length - a.length;
      if (extra > 0 && a.every((v, i) => sameValue(v, b[i + extra]))) {
        for (let i = 0; i < extra; i++) ops.push({op:"insert",path:[...path,String(i)],value:b[i]});
        return;
      }
      if (a.length === b.length) { a.forEach((v,i)=>visit(v,b[i],[...path,String(i)])); return; }
    }
    if (object(a) && object(b)) {
      for (const k of Object.keys(a)) if (a[k] !== undefined && (!(k in b) || b[k] === undefined)) ops.push({op:"remove",path:[...path,k]});
      for (const k of Object.keys(b)) if (b[k] !== undefined) visit(a[k],b[k],[...path,k]);
      return;
    }
    if (b === undefined) ops.push({op:"remove",path});
    else ops.push({op:"set",path,value:b});
  };
  visit(before,after,[]);
  return ops;
}
