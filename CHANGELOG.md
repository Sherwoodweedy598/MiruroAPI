# Changelog

## v1.1.0
- Added Swagger UI interactive docs at /docs
- Added OpenAPI 3.0 spec at /openapi.json
- Added mappings field in episodes response (anilistId, malId, kitsuId)
- Added Docker support (Dockerfile + .dockerignore)
- Improved landing page with premium design (Walter-style)
- Added "Try it" buttons on all endpoints
- Health endpoint now includes version, providers list, and endpoint count
- Version bump to 1.1.0

## v1.0.0
- Initial release
- AniList GraphQL integration for anime metadata
- Miruro pipe integration for streaming sources
- 16 API endpoints: search, suggestions, trending, popular, upcoming, recent, spotlight, schedule, filter, info, characters, relations, recommendations, episodes, sources, watch
- In-memory caching with TTL
- CORS support
- Health endpoint
- Deployed on Vercel
