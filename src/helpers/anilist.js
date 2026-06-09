const axios = require("axios");

const ANILIST_URL = "https://graphql.anilist.co";

const MEDIA_LIST_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  format
  season
  seasonYear
  episodes
  duration
  status
  averageScore
  meanScore
  popularity
  favourites
  genres
  source
  countryOfOrigin
  isAdult
  studios(isMain: true) { nodes { name isAnimationStudio } }
  nextAiringEpisode { episode airingAt timeUntilAiring }
  startDate { year month day }
  endDate { year month day }
`;

const MEDIA_FULL_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { large extraLarge color }
  bannerImage
  format
  season
  seasonYear
  episodes
  duration
  status
  averageScore
  meanScore
  popularity
  favourites
  trending
  genres
  tags { name rank isMediaSpoiler }
  source
  countryOfOrigin
  isAdult
  hashtag
  synonyms
  siteUrl
  trailer { id site thumbnail }
  studios { nodes { id name isAnimationStudio siteUrl } }
  nextAiringEpisode { episode airingAt timeUntilAiring }
  startDate { year month day }
  endDate { year month day }
  characters(sort: [ROLE, RELEVANCE], perPage: 25) {
    edges {
      role
      node { id name { full native } image { large } }
      voiceActors(language: JAPANESE) { id name { full native } image { large } languageV2 }
    }
  }
  staff(sort: RELEVANCE, perPage: 25) {
    edges {
      role
      node { id name { full native } image { large } }
    }
  }
  relations {
    edges {
      relationType(version: 2)
      node {
        id
        title { romaji english native }
        coverImage { large }
        format
        type
        status
        episodes
        meanScore
      }
    }
  }
  recommendations(sort: RATING_DESC, perPage: 10) {
    nodes {
      rating
      mediaRecommendation {
        id
        title { romaji english native }
        coverImage { large }
        format
        episodes
        status
        meanScore
        averageScore
      }
    }
  }
  externalLinks { url site type }
  streamingEpisodes { title thumbnail url site }
  stats {
    scoreDistribution { score amount }
    statusDistribution { status amount }
  }
`;

async function anilistQuery(query, variables = {}) {
  const body = { query, variables };
  const res = await axios.post(ANILIST_URL, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  if (res.status !== 200) throw new Error("AniList query failed");
  return res.data.data;
}

async function searchAnime(query, page = 1, perPage = 20) {
  const gql = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          ${MEDIA_LIST_FIELDS}
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { search: query, page, perPage });
  const pageData = data.Page;
  return {
    page: pageData.pageInfo.currentPage,
    perPage: pageData.pageInfo.perPage,
    total: pageData.pageInfo.total,
    hasNextPage: pageData.pageInfo.hasNextPage,
    results: pageData.media,
  };
}

async function getSuggestions(query) {
  const gql = `
    query ($search: String) {
      Page(page: 1, perPage: 8) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { romaji english }
          coverImage { large }
          format
          status
          startDate { year }
          episodes
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { search: query });
  return data.Page.media.map((item) => ({
    id: item.id,
    title: item.title.english || item.title.romaji,
    title_romaji: item.title.romaji,
    poster: item.coverImage.large,
    format: item.format,
    status: item.status,
    year: item.startDate?.year,
    episodes: item.episodes,
  }));
}

async function getAnimeInfo(id) {
  const gql = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FULL_FIELDS}
      }
    }
  `;
  const data = await anilistQuery(gql, { id });
  return data.Media;
}

async function getAnimeCharacters(id, page = 1, perPage = 25) {
  const gql = `
    query ($id: Int, $page: Int, $perPage: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english }
        characters(sort: [ROLE, RELEVANCE], page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          edges {
            role
            node { id name { full native userPreferred } image { large medium } description gender favourites siteUrl }
            voiceActors { id name { full native } image { large } languageV2 }
          }
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { id, page, perPage });
  if (!data.Media) throw new Error("Anime not found");
  const chars = data.Media.characters;
  return {
    page: chars.pageInfo.currentPage,
    perPage: chars.pageInfo.perPage,
    total: chars.pageInfo.total,
    hasNextPage: chars.pageInfo.hasNextPage,
    characters: chars.edges,
  };
}

async function getAnimeRelations(id) {
  const gql = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english }
        relations {
          edges {
            relationType(version: 2)
            node {
              id title { romaji english native } coverImage { large }
              format type status episodes meanScore averageScore popularity
            }
          }
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { id });
  if (!data.Media) throw new Error("Anime not found");
  return {
    id: data.Media.id,
    title: data.Media.title,
    relations: data.Media.relations.edges,
  };
}

async function getAnimeRecommendations(id, page = 1, perPage = 10) {
  const gql = `
    query ($id: Int, $page: Int, $perPage: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english }
        recommendations(sort: RATING_DESC, page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          nodes {
            rating
            mediaRecommendation {
              id title { romaji english native } coverImage { large extraLarge }
              format episodes status meanScore averageScore popularity genres
            }
          }
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { id, page, perPage });
  if (!data.Media) throw new Error("Anime not found");
  const recs = data.Media.recommendations;
  return {
    page: recs.pageInfo.currentPage,
    perPage: recs.pageInfo.perPage,
    total: recs.pageInfo.total,
    hasNextPage: recs.pageInfo.hasNextPage,
    recommendations: recs.nodes,
  };
}

async function getCollection(sortType, status = null, page = 1, perPage = 20) {
  const statusFilter = status ? `, status: ${status}` : "";
  const gql = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(type: ANIME, sort: [${sortType}]${statusFilter}) {
          ${MEDIA_LIST_FIELDS}
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { page, perPage });
  const pageData = data.Page;
  return {
    page: pageData.pageInfo.currentPage,
    perPage: pageData.pageInfo.perPage,
    total: pageData.pageInfo.total,
    hasNextPage: pageData.pageInfo.hasNextPage,
    results: pageData.media,
  };
}

async function getSpotlight() {
  const gql = `
    query {
      Page(page: 1, perPage: 10) {
        media(sort: [TRENDING_DESC, POPULARITY_DESC], type: ANIME) {
          ${MEDIA_LIST_FIELDS}
        }
      }
    }
  `;
  const data = await anilistQuery(gql);
  return data.Page.media;
}

async function getSchedule(page = 1, perPage = 20) {
  const gql = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        airingSchedules(notYetAired: true, sort: TIME) {
          episode
          airingAt
          timeUntilAiring
          media { ${MEDIA_LIST_FIELDS} }
        }
      }
    }
  `;
  const data = await anilistQuery(gql, { page, perPage });
  const pageData = data.Page;
  const results = pageData.airingSchedules.map((item) => ({
    ...item.media,
    next_episode: item.episode,
    airingAt: item.airingAt,
    timeUntilAiring: item.timeUntilAiring,
  }));
  return {
    page: pageData.pageInfo.currentPage,
    perPage: pageData.pageInfo.perPage,
    total: pageData.pageInfo.total,
    hasNextPage: pageData.pageInfo.hasNextPage,
    results,
  };
}

async function filterAnime({ genre, tag, year, season, format, status, sort = "POPULARITY_DESC", page = 1, perPage = 20 }) {
  const SORT_MAP = {
    SCORE_DESC: "SCORE_DESC",
    POPULARITY_DESC: "POPULARITY_DESC",
    TRENDING_DESC: "TRENDING_DESC",
    START_DATE_DESC: "START_DATE_DESC",
    FAVOURITES_DESC: "FAVOURITES_DESC",
    UPDATED_AT_DESC: "UPDATED_AT_DESC",
  };

  const args = ["type: ANIME", `sort: [${SORT_MAP[sort] || "POPULARITY_DESC"}]`];
  const variables = { page, perPage };
  const varTypes = ["$page: Int", "$perPage: Int"];

  if (genre) { args.push("genre: $genre"); variables.genre = genre; varTypes.push("$genre: String"); }
  if (tag) { args.push("tag: $tag"); variables.tag = tag; varTypes.push("$tag: String"); }
  if (year) { args.push("seasonYear: $seasonYear"); variables.seasonYear = year; varTypes.push("$seasonYear: Int"); }
  if (season) { args.push("season: $season"); variables.season = season.toUpperCase(); varTypes.push("$season: MediaSeason"); }
  if (format) { args.push("format: $format"); variables.format = format.toUpperCase(); varTypes.push("$format: MediaFormat"); }
  if (status) { args.push("status: $status"); variables.status = status.toUpperCase(); varTypes.push("$status: MediaStatus"); }

  const gql = `
    query (${varTypes.join(", ")}) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(${args.join(", ")}) {
          ${MEDIA_LIST_FIELDS}
        }
      }
    }
  `;
  const data = await anilistQuery(gql, variables);
  const pageData = data.Page;
  return {
    page: pageData.pageInfo.currentPage,
    perPage: pageData.pageInfo.perPage,
    total: pageData.pageInfo.total,
    hasNextPage: pageData.pageInfo.hasNextPage,
    results: pageData.media,
  };
}

module.exports = {
  anilistQuery,
  searchAnime,
  getSuggestions,
  getAnimeInfo,
  getAnimeCharacters,
  getAnimeRelations,
  getAnimeRecommendations,
  getCollection,
  getSpotlight,
  getSchedule,
  filterAnime,
  MEDIA_LIST_FIELDS,
  MEDIA_FULL_FIELDS,
};
