const express = require("express");
const router = express.Router();
const anilist = require("../helpers/anilist");
const pipe = require("../helpers/pipe");
const { getCached, setCache } = require("../helpers/cache");

function handleErrors(res, err) {
  console.error(err.message);
  res.status(500).json({ success: false, message: err.message });
}

// Search
router.get("/search", async (req, res) => {
  try {
    const { query, page = 1, per_page = 20 } = req.query;
    if (!query) return res.status(400).json({ success: false, message: "query parameter is required" });
    const cacheKey = `search:${query}:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.searchAnime(query, parseInt(page), parseInt(per_page));
      setCache(cacheKey, result);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Suggestions
router.get("/suggestions", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: "query parameter is required" });
    const cacheKey = `suggestions:${query}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getSuggestions(query);
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Trending
router.get("/trending", async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const cacheKey = `trending:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getCollection("TRENDING_DESC", null, parseInt(page), parseInt(per_page));
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Popular
router.get("/popular", async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const cacheKey = `popular:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getCollection("POPULARITY_DESC", null, parseInt(page), parseInt(per_page));
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Upcoming
router.get("/upcoming", async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const cacheKey = `upcoming:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getCollection("POPULARITY_DESC", "NOT_YET_RELEASED", parseInt(page), parseInt(per_page));
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Recent
router.get("/recent", async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const cacheKey = `recent:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getCollection("START_DATE_DESC", "RELEASING", parseInt(page), parseInt(per_page));
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Spotlight
router.get("/spotlight", async (req, res) => {
  try {
    const cacheKey = "spotlight";
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getSpotlight();
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Schedule
router.get("/schedule", async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const cacheKey = `schedule:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getSchedule(parseInt(page), parseInt(per_page));
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Filter
router.get("/filter", async (req, res) => {
  try {
    const { genre, tag, year, season, format, status, sort = "POPULARITY_DESC", page = 1, per_page = 20 } = req.query;
    const cacheKey = `filter:${genre}:${tag}:${year}:${season}:${format}:${status}:${sort}:${page}:${per_page}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.filterAnime({
        genre, tag, year: year ? parseInt(year) : null, season, format, status, sort,
        page: parseInt(page), perPage: parseInt(per_page),
      });
      setCache(cacheKey, result);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Info
router.get("/info/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid AniList ID" });
    const cacheKey = `info:${id}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await anilist.getAnimeInfo(id);
      setCache(cacheKey, result, 300 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Characters
router.get("/anime/:id/characters", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, per_page = 25 } = req.query;
    const result = await anilist.getAnimeCharacters(id, parseInt(page), parseInt(per_page));
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Relations
router.get("/anime/:id/relations", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await anilist.getAnimeRelations(id);
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Recommendations
router.get("/anime/:id/recommendations", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, per_page = 10 } = req.query;
    const result = await anilist.getAnimeRecommendations(id, parseInt(page), parseInt(per_page));
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Episodes
router.get("/episodes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid AniList ID" });
    const cacheKey = `episodes:${id}`;
    let result = getCached(cacheKey);
    if (!result) {
      result = await pipe.getEpisodes(id);
      setCache(cacheKey, result, 120 * 1000);
    }
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Sources (manual)
router.get("/sources", async (req, res) => {
  try {
    const { episodeId, provider, anilistId, category = "sub" } = req.query;
    if (!episodeId || !provider || !anilistId) {
      return res.status(400).json({ success: false, message: "episodeId, provider, and anilistId are required" });
    }
    const result = await pipe.getSources(episodeId, provider, parseInt(anilistId), category);
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

// Watch (simple slug-based sources)
router.get("/watch/:provider/:anilistId/:category/:slug", async (req, res) => {
  try {
    const { provider, anilistId, category, slug } = req.params;
    const result = await pipe.getWatchSources(provider, parseInt(anilistId), category, slug);
    res.json({ success: true, results: result });
  } catch (err) { handleErrors(res, err); }
});

module.exports = router;
