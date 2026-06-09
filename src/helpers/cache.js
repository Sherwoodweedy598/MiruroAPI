const cache = new Map();
const MAX_CACHE_SIZE = 100;
const DEFAULT_TTL = 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl = DEFAULT_TTL) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, expiry: Date.now() + ttl });
}

function clearCache() {
  cache.clear();
}

module.exports = { getCached, setCache, clearCache };
