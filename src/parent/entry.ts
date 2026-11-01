export function parentTokenFromLocation(location: Pick<Location, "pathname" | "search" | "hash">): string | null {
  const path = location.pathname.match(/\/parent\/([a-zA-Z0-9_-]+)/);
  if (path) return path[1];
  const query = new URLSearchParams(location.search).get("parent");
  if (query?.trim()) return query.trim();
  return location.hash.match(/#\/?parent\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}
