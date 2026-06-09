/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — apiRoutes.js
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   Central API router that maps all Express GET endpoints to their
 *   corresponding handler functions. Each route wraps its handler
 *   in try/catch for consistent error handling. Includes health,
 *   stats, and OpenAPI specification endpoints.
 *
 * @exports
 *   createApiRoutes - Function that registers all API routes
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const express = require("express");
const anilist = require("../helpers/anilist");
const pipe = require("../helpers/pipe");
const { getCached, setCache } = require("../helpers/cache");

// ══════════════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Main API route registration function ----
/**
 * Registers all API routes on the Express app.
 * Receives response helpers for consistent JSON formatting.
 *
 * @param {object} app - Express application instance
 * @param {function} jsonResponse - Standardized success response wrapper
 * @param {function} jsonError - Standardized error response wrapper
 * @returns {express.Router} Configured router
 */
const createApiRoutes = (jsonResponse, jsonError) => {
  const router = express.Router();

  // ══════════════════════════════════════════════════════════════
  // REQUEST COUNTER (must be before all routes)
  // ══════════════════════════════════════════════════════════════

  const startTime = Date.now();
  let requestCount = 0;
  let errorCount = 0;

  router.use((req, res, next) => {
    requestCount++;
    res.on("finish", () => {
      if (res.statusCode >= 400) errorCount++;
    });
    next();
  });

  // ══════════════════════════════════════════════════════════════
  // SEARCH & DISCOVERY
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Full-text anime search with pagination ----
  router.get("/search", async (req, res) => {
    try {
      const { query, page = 1, per_page = 20 } = req.query;
      if (!query) return jsonError(res, "query parameter is required", 400);

      const cacheKey = `search:${query}:${page}:${per_page}`;
      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.searchAnime(query, parseInt(page), parseInt(per_page));
        setCache(cacheKey, result);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Lightweight autocomplete suggestions (max 8) ----
  router.get("/suggestions", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) return jsonError(res, "query parameter is required", 400);

      const cacheKey = `suggestions:${query}`;
      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getSuggestions(query);
        // NOTE: Cache suggestions longer (2 minutes) — they change less frequently
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Advanced anime filter with multiple parameters ----
  router.get("/filter", async (req, res) => {
    try {
      const { genre, tag, year, season, format, status, sort = "POPULARITY_DESC", page = 1, per_page = 20 } = req.query;
      const cacheKey = `filter:${genre}:${tag}:${year}:${season}:${format}:${status}:${sort}:${page}:${per_page}`;

      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.filterAnime({
          genre, tag, year: year ? parseInt(year) : null,
          season, format, status, sort,
          page: parseInt(page), perPage: parseInt(per_page),
        });
        setCache(cacheKey, result);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // COLLECTIONS
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Currently trending anime ----
  router.get("/trending", async (req, res) => {
    try {
      const { page = 1, per_page = 20 } = req.query;
      const cacheKey = `trending:${page}:${per_page}`;

      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getCollection("TRENDING_DESC", null, parseInt(page), parseInt(per_page));
        // NOTE: Cache trending for 2 minutes — changes less frequently than search
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Most popular anime of all time ----
  router.get("/popular", async (req, res) => {
    try {
      const { page = 1, per_page = 20 } = req.query;
      const cacheKey = `popular:${page}:${per_page}`;

      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getCollection("POPULARITY_DESC", null, parseInt(page), parseInt(per_page));
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Most anticipated upcoming anime ----
  router.get("/upcoming", async (req, res) => {
    try {
      const { page = 1, per_page = 20 } = req.query;
      const cacheKey = `upcoming:${page}:${per_page}`;

      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getCollection("POPULARITY_DESC", "NOT_YET_RELEASED", parseInt(page), parseInt(per_page));
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Currently airing anime ----
  router.get("/recent", async (req, res) => {
    try {
      const { page = 1, per_page = 20 } = req.query;
      const cacheKey = `recent:${page}:${per_page}`;

      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getCollection("START_DATE_DESC", "RELEASING", parseInt(page), parseInt(per_page));
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Spotlight/featured anime (top 10) ----
  router.get("/spotlight", async (req, res) => {
    try {
      const cacheKey = "spotlight";
      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getSpotlight();
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Airing schedule with timestamps ----
  router.get("/schedule", async (req, res) => {
    try {
      const { page = 1, per_page = 20 } = req.query;
      const cacheKey = `schedule:${page}:${per_page}`;

      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getSchedule(parseInt(page), parseInt(per_page));
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // ANIME DETAILS
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Complete anime info by AniList ID ----
  router.get("/info/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return jsonError(res, "Invalid AniList ID", 400);

      const cacheKey = `info:${id}`;
      let result = getCached(cacheKey);
      if (!result) {
        result = await anilist.getAnimeInfo(id);
        // NOTE: Cache info for 5 minutes — detailed data changes infrequently
        setCache(cacheKey, result, 300 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Paginated character list with voice actors ----
  router.get("/anime/:id/characters", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { page = 1, per_page = 25 } = req.query;
      const result = await anilist.getAnimeCharacters(id, parseInt(page), parseInt(per_page));
      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Related anime (sequels, prequels, spin-offs) ----
  router.get("/anime/:id/relations", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await anilist.getAnimeRelations(id);
      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Community recommendations sorted by rating ----
  router.get("/anime/:id/recommendations", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { page = 1, per_page = 10 } = req.query;
      const result = await anilist.getAnimeRecommendations(id, parseInt(page), parseInt(per_page));
      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // STREAMING
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Episode list from all providers ----
  router.get("/episodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return jsonError(res, "Invalid AniList ID", 400);

      const cacheKey = `episodes:${id}`;
      let result = getCached(cacheKey);
      if (!result) {
        result = await pipe.getEpisodes(id);
        // NOTE: Cache episodes for 2 minutes — episode lists change during airing
        setCache(cacheKey, result, 120 * 1000);
      }

      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Streaming sources (detailed/manual endpoint) ----
  router.get("/sources", async (req, res) => {
    try {
      const { episodeId, provider, anilistId, category = "sub" } = req.query;
      if (!episodeId || !provider || !anilistId) {
        return jsonError(res, "episodeId, provider, and anilistId are required", 400);
      }

      const result = await pipe.getSources(episodeId, provider, parseInt(anilistId), category);
      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ---- FEATURE: Streaming sources (simple slug-based endpoint) ----
  router.get("/watch/:provider/:anilistId/:category/:slug", async (req, res) => {
    try {
      const { provider, anilistId, category, slug } = req.params;
      const result = await pipe.getWatchSources(provider, parseInt(anilistId), category, slug);
      jsonResponse(res, result);
    } catch (err) {
      jsonError(res, err.message);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // HEALTH & STATS
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Health check endpoint ----
  router.get("/health", (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    res.json({
      success: true,
      results: {
        status: "healthy",
        version: "1.1.0",
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        uptimeSeconds: uptime,
        timestamp: new Date().toISOString(),
        node: process.version,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
        },
        endpoints: 16,
        providers: ["kiwi", "pewe", "bee", "bonk", "bun", "ally", "nun", "twin", "cog", "moo", "hop", "telli"],
      },
    });
  });

  // ---- FEATURE: Cache & API statistics ----
  router.get("/stats", (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      results: {
        uptime: uptime + "s",
        requests: {
          total: requestCount,
          errors: errorCount,
          successRate: requestCount > 0
            ? ((1 - errorCount / requestCount) * 100).toFixed(1) + "%"
            : "100%",
        },
        cache: {
          type: "in-memory",
          ttl: "1 minute (default), 2-5 minutes for collections",
          maxSize: 100,
          description: "Map-based cache with TTL expiration and FIFO eviction",
        },
        endpoints: 16,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ---- FEATURE: OpenAPI specification ----
  router.get("/openapi", (req, res) => {
    res.json({
      openapi: "3.0.3",
      info: {
        title: "MiruroAPI",
        description: "Free REST API for anime streaming data — AniList GraphQL + Miruro streaming providers",
        version: "1.1.0",
        contact: { name: "Shineii86", url: "https://github.com/Shineii86/MiruroAPI" },
      },
      servers: [
        { url: "https://mirurotvapi.vercel.app/api", description: "Production" },
      ],
      paths: {
        "/search": { get: { summary: "Search anime", tags: ["Search"] } },
        "/suggestions": { get: { summary: "Autocomplete suggestions", tags: ["Search"] } },
        "/filter": { get: { summary: "Advanced filter", tags: ["Search"] } },
        "/trending": { get: { summary: "Trending anime", tags: ["Collections"] } },
        "/popular": { get: { summary: "Most popular", tags: ["Collections"] } },
        "/upcoming": { get: { summary: "Upcoming anime", tags: ["Collections"] } },
        "/recent": { get: { summary: "Recently aired", tags: ["Collections"] } },
        "/spotlight": { get: { summary: "Spotlight anime", tags: ["Collections"] } },
        "/schedule": { get: { summary: "Airing schedule", tags: ["Collections"] } },
        "/info/{id}": { get: { summary: "Full anime info", tags: ["Anime Details"] } },
        "/anime/{id}/characters": { get: { summary: "Characters", tags: ["Anime Details"] } },
        "/anime/{id}/relations": { get: { summary: "Relations", tags: ["Anime Details"] } },
        "/anime/{id}/recommendations": { get: { summary: "Recommendations", tags: ["Anime Details"] } },
        "/episodes/{id}": { get: { summary: "Episode list", tags: ["Streaming"] } },
        "/sources": { get: { summary: "Streaming sources (detailed)", tags: ["Streaming"] } },
        "/watch/{provider}/{anilistId}/{category}/{slug}": { get: { summary: "Streaming sources (simple)", tags: ["Streaming"] } },
        "/health": { get: { summary: "Health check", tags: ["System"] } },
        "/stats": { get: { summary: "API statistics", tags: ["System"] } },
        "/openapi": { get: { summary: "OpenAPI spec", tags: ["System"] } },
      },
      tags: [
        { name: "Search", description: "Search & filter" },
        { name: "Collections", description: "Trending, popular, upcoming, schedule" },
        { name: "Anime Details", description: "Info, characters, relations, recommendations" },
        { name: "Streaming", description: "Episodes, sources, watch" },
        { name: "System", description: "Health, stats, OpenAPI" },
      ],
    });
  });

  return router;
};

module.exports = createApiRoutes;

// ══════════════════════════════════════════════════════════════ END: apiRoutes.js
