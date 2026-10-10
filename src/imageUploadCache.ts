/** Bounded, in-memory deduplication. Failed uploads remain retryable. */
export function cacheImageUploads(upload: (dataUrl: string) => Promise<string>, maxChars = 8_000_000) {
  const completed = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();
  let chars = 0;
  return (dataUrl: string): Promise<string> => {
    const cached = completed.get(dataUrl);
    if (cached) return Promise.resolve(cached);
    const inFlight = pending.get(dataUrl);
    if (inFlight) return inFlight;
    const request = Promise.resolve().then(() => upload(dataUrl)).then((url) => {
      if (!url || url.startsWith("data:")) throw new Error("Image upload did not return a stored reference");
      if (dataUrl.length <= maxChars) {
        while (completed.size && (chars + dataUrl.length > maxChars || completed.size >= 32)) {
          const oldest = completed.keys().next().value!;
          chars -= oldest.length;
          completed.delete(oldest);
        }
        completed.set(dataUrl, url);
        chars += dataUrl.length;
      }
      return url;
    }).finally(() => pending.delete(dataUrl));
    pending.set(dataUrl, request);
    return request;
  };
}
