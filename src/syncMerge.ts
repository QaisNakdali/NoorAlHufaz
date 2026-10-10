export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, index) => sameValue(value, b[index]));
  }
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  // Undefined optional fields are absent in persisted JSON.
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  const otherKeys = Object.keys(right).filter((key) => right[key] !== undefined);
  return keys.length === otherKeys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]));
}

function arrayItemKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  for (const field of ["id", "week", "itemId", "key"] as const) {
    const key = item[field];
    if (typeof key === "string" || typeof key === "number") return `${field}:${String(key)}`;
  }
  return null;
}

export type MergeConflict = {
  path: string;
  kind: "same-field" | "delete-vs-update";
};

function noteConflict(conflicts: MergeConflict[] | undefined, path: string[], kind: MergeConflict["kind"]): void {
  if (!conflicts) return;
  const value = { path: path.join("."), kind };
  if (!conflicts.some((item) => item.path === value.path && item.kind === value.kind)) conflicts.push(value);
}

/** يطبق فقط الفروق المحلية فوق أحدث نسخة سحابية دون إسقاط إضافات الأجهزة الأخرى. */
export function mergeLocalChanges(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string[] = [],
  conflicts?: MergeConflict[]
): unknown {
  if (sameValue(local, base)) return remote;
  if (sameValue(remote, base) || sameValue(local, remote)) return local;

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const keyed = [...base, ...local, ...remote].every((item) => arrayItemKey(item) !== null);
    if (keyed) {
      const baseMap = new Map(base.map((item) => [arrayItemKey(item) as string, item]));
      const localMap = new Map(local.map((item) => [arrayItemKey(item) as string, item]));
      const remoteMap = new Map(remote.map((item) => [arrayItemKey(item) as string, item]));
      const order = [...remoteMap.keys(), ...[...localMap.keys()].filter((key) => !remoteMap.has(key))];
      const merged: unknown[] = [];
      for (const key of order) {
        const hadBase = baseMap.has(key);
        const hasLocal = localMap.has(key);
        const hasRemote = remoteMap.has(key);
        if (hadBase && !hasLocal) {
          if (hasRemote && !sameValue(remoteMap.get(key), baseMap.get(key))) {
            noteConflict(conflicts, [...path, key], "delete-vs-update");
            merged.push(remoteMap.get(key));
          }
          continue;
        }
        if (!hasLocal && hasRemote) {
          merged.push(remoteMap.get(key));
          continue;
        }
        if (hasLocal && !hasRemote) {
          if (!hadBase) merged.push(localMap.get(key));
          else if (!sameValue(localMap.get(key), baseMap.get(key))) {
            noteConflict(conflicts, [...path, key], "delete-vs-update");
            merged.push(localMap.get(key));
          }
          continue;
        }
        merged.push(mergeLocalChanges(baseMap.get(key), localMap.get(key), remoteMap.get(key), [...path, key], conflicts));
      }
      return merged;
    }

    const result = [...remote];
    for (const oldItem of base) {
      if (!local.some((item) => sameValue(item, oldItem))) {
        const index = result.findIndex((item) => sameValue(item, oldItem));
        if (index >= 0) result.splice(index, 1);
      }
    }
    for (const item of local) {
      if (!base.some((oldItem) => sameValue(oldItem, item)) && !result.some((current) => sameValue(current, item))) result.push(item);
    }
    return result;
  }

  if (base && local && remote && typeof base === "object" && typeof local === "object" && typeof remote === "object") {
    const b = base as Record<string, unknown>;
    const l = local as Record<string, unknown>;
    const r = remote as Record<string, unknown>;
    const result: Record<string, unknown> = { ...r };
    for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
      if (key in b && !(key in l)) {
        if (key in r && !sameValue(r[key], b[key])) {
          noteConflict(conflicts, [...path, key], "delete-vs-update");
          result[key] = r[key];
        } else delete result[key];
      } else if (key in l) result[key] = mergeLocalChanges(b[key], l[key], r[key], [...path, key], conflicts);
    }
    return result;
  }

  const field = path[path.length - 1];
  if (["manualCoinsAdjust", "manualXpAdjust"].includes(field)
    && typeof base === "number" && typeof local === "number" && typeof remote === "number") {
    return remote + (local - base);
  }
  if (["coins", "xp", "hearts", "heartsLostWeek", "qty", "receivedQty", "coinsSpent"].includes(field)
    && typeof base === "number" && typeof local === "number" && typeof remote === "number") {
    return Math.max(0, remote + (local - base));
  }
  if (!sameValue(local, base)) {
    noteConflict(conflicts, path, "same-field");
    return local;
  }
  return remote;
}
