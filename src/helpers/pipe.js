const axios = require("axios");
const { Buffer } = require("buffer");
const zlib = require("zlib");

const MIRURO_PIPE_URL = "https://www.miruro.tv/api/secure/pipe";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Referer: "https://www.miruro.tv/",
};

function encodePipeRequest(payload) {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString("base64url");
}

function decodePipeResponse(encodedStr) {
  try {
    const padded = encodedStr + "=".repeat((4 - (encodedStr.length % 4)) % 4);
    const compressed = Buffer.from(padded, "base64url");
    const decompressed = zlib.gunzipSync(compressed);
    return JSON.parse(decompressed.toString("utf-8"));
  } catch (e) {
    throw new Error("Failed to decode pipe response: " + e.message);
  }
}

function translateId(encodedId) {
  try {
    const padded = encodedId + "=".repeat((4 - (encodedId.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64url").toString("utf-8");
    if (decoded.includes(":")) return decoded;
    return encodedId;
  } catch {
    return encodedId;
  }
}

function deepTranslate(obj) {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key === "id" && typeof obj[key] === "string") {
        obj[key] = translateId(obj[key]);
      } else if (typeof obj[key] === "object") {
        deepTranslate(obj[key]);
      }
    }
  }
  return obj;
}

function injectSourceSlugs(data, anilistId) {
  const providers = data.providers || {};
  for (const [provName, provData] of Object.entries(providers)) {
    if (!provData || typeof provData !== "object") continue;
    let episodes = provData.episodes;
    if (!episodes) continue;
    if (Array.isArray(episodes)) {
      provData.episodes = { sub: episodes };
      episodes = provData.episodes;
    }
    for (const [category, epList] of Object.entries(episodes)) {
      if (!Array.isArray(epList)) continue;
      for (const ep of epList) {
        if (ep.id && ep.number) {
          const origId = ep.id;
          const prefix = origId.includes(":") ? origId.split(":")[0] : origId;
          ep.id = `watch/${provName}/${anilistId}/${category}/${prefix}-${ep.number}`;
        }
      }
    }
  }
  return data;
}

async function fetchRawEpisodes(anilistId) {
  const payload = {
    path: "episodes",
    method: "GET",
    query: { anilistId },
    body: null,
    version: "0.1.0",
  };
  const encodedReq = encodePipeRequest(payload);
  const res = await axios.get(`${MIRURO_PIPE_URL}?e=${encodedReq}`, {
    headers: HEADERS,
    timeout: 15000,
  });
  if (res.status !== 200) throw new Error(`Pipe request failed: ${res.status}`);
  const data = decodePipeResponse(res.text || res.data);
  return deepTranslate(data);
}

async function getEpisodes(anilistId) {
  const data = await fetchRawEpisodes(anilistId);
  const result = injectSourceSlugs(data, anilistId);
  // Ensure mappings field is present (like Walter's API)
  if (!result.mappings) {
    result.mappings = { anilistId };
    if (result.malId) result.mappings.malId = result.malId;
    if (result.kitsuId) result.mappings.kitsuId = result.kitsuId;
  }
  return result;
}

async function getSources(episodeId, provider, anilistId, category = "sub") {
  const encId = Buffer.from(episodeId).toString("base64url");
  const payload = {
    path: "sources",
    method: "GET",
    query: { episodeId: encId, provider, category, anilistId },
    body: null,
    version: "0.1.0",
  };
  const encodedReq = encodePipeRequest(payload);
  const res = await axios.get(`${MIRURO_PIPE_URL}?e=${encodedReq}`, {
    headers: HEADERS,
    timeout: 15000,
  });
  if (res.status !== 200) throw new Error(`Pipe sources request failed: ${res.status}`);
  return deepTranslate(decodePipeResponse(res.text || res.data));
}

async function getWatchSources(provider, anilistId, category, slug) {
  const data = await fetchRawEpisodes(anilistId);
  const provData = (data.providers || {})[provider];
  if (!provData) throw new Error(`Provider ${provider} not found`);
  const episodes = provData.episodes?.[category] || [];
  let targetId = null;
  for (const ep of episodes) {
    const origId = ep.id || "";
    const prefix = origId.includes(":") ? origId.split(":")[0] : origId;
    const generated = `${prefix}-${ep.number}`;
    if (generated === slug) {
      targetId = origId;
      break;
    }
  }
  if (!targetId) throw new Error(`Episode slug '${slug}' not found for provider ${provider}`);
  return getSources(targetId, provider, anilistId, category);
}

module.exports = {
  getEpisodes,
  getSources,
  getWatchSources,
  encodePipeRequest,
  decodePipeResponse,
  translateId,
  deepTranslate,
  injectSourceSlugs,
};
