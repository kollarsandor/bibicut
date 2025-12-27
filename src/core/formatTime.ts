const cache = new Map<number, string>();
const MAX_CACHE_SIZE = 7200;

export function formatTime(seconds: number): string {
  const floored = Math.floor(seconds);
  const cached = cache.get(floored);
  if (cached !== undefined) {
    return cached;
  }
  const mins = Math.floor(floored / 60);
  const secs = floored % 60;
  const result = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  if (cache.size < MAX_CACHE_SIZE) {
    cache.set(floored, result);
  }
  return result;
}

export function clearFormatTimeCache(): void {
  cache.clear();
}

export function precomputeFormatTimeRange(maxSeconds: number): void {
  const limit = Math.min(maxSeconds, MAX_CACHE_SIZE);
  for (let i = 0; i <= limit; i++) {
    if (!cache.has(i)) {
      const mins = Math.floor(i / 60);
      const secs = i % 60;
      cache.set(i, (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs);
    }
  }
}
