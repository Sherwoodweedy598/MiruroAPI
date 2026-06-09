# MiruroAPI

Free RESTful API for anime streaming data. Powered by AniList GraphQL and Miruro streaming providers.

## Live

- **API**: `https://miruroapi-zeta.vercel.app`
- **GitHub**: `https://github.com/Shineii86/MiruroAPI`

## Features

- 16 API endpoints
- AniList GraphQL for metadata (search, trending, info, filter, schedule)
- 12 streaming providers (kiwi, pewe, bee, bonk, bun, ally, nun, twin, cog, moo, hop, telli)
- M3U8 streaming URLs with subtitles and skip timestamps
- In-memory caching
- CORS enabled

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/search?query=naruto` | Search anime by name |
| `GET /api/suggestions?query=naruto` | Autocomplete suggestions |
| `GET /api/trending` | Trending anime |
| `GET /api/popular` | Most popular anime |
| `GET /api/upcoming` | Upcoming anime |
| `GET /api/recent` | Currently airing anime |
| `GET /api/spotlight` | Spotlight/featured anime |
| `GET /api/schedule` | Airing schedule |
| `GET /api/filter?genre=Action` | Advanced filter |
| `GET /api/info/:id` | Full anime info by AniList ID |
| `GET /api/anime/:id/characters` | Characters with voice actors |
| `GET /api/anime/:id/relations` | Related anime |
| `GET /api/anime/:id/recommendations` | Recommendations |
| `GET /api/episodes/:id` | Episode list from all providers |
| `GET /api/sources?episodeId=...&provider=...&anilistId=...` | Streaming sources |
| `GET /api/watch/:provider/:anilistId/:category/:slug` | Simple streaming sources |

## Streaming Flow

1. `GET /api/episodes/:anilistId` — get episode list with provider IDs
2. `GET /api/watch/:provider/:anilistId/:category/:slug` — get M3U8 URL
3. Play M3U8 in any HLS player

## Setup

```bash
npm install
npm start
```

## License

MIT
