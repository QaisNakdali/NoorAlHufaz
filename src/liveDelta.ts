import type { CloudPatch } from "./cloudPatch";

export type LiveSnapshot = { rev: number; data: unknown };
export type LiveDelta = { baseRev: number; rev: number; patch?: CloudPatch[] };

/** Apply only to the exact server revision. Never apply a delta to local unsaved state. */
export function applyLiveDelta(snapshot: LiveSnapshot | null, event: LiveDelta): LiveSnapshot | null {
  if (!snapshot || !Number.isSafeInteger(event.rev) || !Number.isSafeInteger(event.baseRev)) return null;
  if (event.rev <= snapshot.rev) return snapshot;
  if (event.baseRev !== snapshot.rev || !Array.isArray(event.patch)) return null;
  let data: any = structuredClone(snapshot.data);
  try {
    for (const change of event.patch) {
      if (!Array.isArray(change.path) || change.path.length > 32 || change.path.some(k => typeof k !== "string" || ["__proto__", "constructor", "prototype"].includes(k))) return null;
      if (change.path.length === 0) {
        if (change.op !== "set") return null;
        data = structuredClone(change.value);
        continue;
      }
      let target = data;
      for (const key of change.path.slice(0, -1)) {
        if (!target || typeof target !== "object" || !Object.prototype.hasOwnProperty.call(target, key)) return null;
        target = target[key];
      }
      if (!target || typeof target !== "object") return null;
      const key = change.path[change.path.length - 1];
      if (Array.isArray(target)) {
        if (!/^(0|[1-9]\d*)$/.test(key)) return null;
        const index = Number(key);
        if (index > target.length || (change.op !== "insert" && index >= target.length)) return null;
        if (change.op === "insert") target.splice(index, 0, structuredClone(change.value));
        else if (change.op === "remove") target.splice(index, 1);
        else if (change.op === "set") target[index] = structuredClone(change.value);
        else return null;
      } else if (change.op === "remove") delete target[key];
      else if (change.op === "set") target[key] = structuredClone(change.value);
      else return null;
    }
    return { rev: event.rev, data };
  } catch { return null; }
}
