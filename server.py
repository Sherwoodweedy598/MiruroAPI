from flask import Flask, jsonify, request
import requests
import time

app = Flask(__name__)

ANILIST_API = 'https://graphql.anilist.co'

MEDIA_FIELDS = '''
  id
  idMal
  title { romaji english native userPreferred }
  description(asHtml: false)
  coverImage { large medium color }
  bannerImage
  format
  status
  episodes
  duration
  season
  seasonYear
  genres
  tags { name }
  averageScore
  meanScore
  popularity
  trending
  favourites
  startDate { year month day }
  endDate { year month day }
  nextAiringEpisode { episode timeUntilAiring airingAt }
  studios(isMain: true) { edges { node { id name } isMain } }
  trailer { id site thumbnail url }
  rankings { rank type context year season allTime }
'''


def anilist_query(query, variables=None):
    if variables is None:
        variables = {}
    res = requests.post(ANILIST_API, json={'query': query, 'variables': variables})
    data = res.json()
    if 'errors' in data:
        raise Exception(data['errors'][0]['message'])
    return data['data']


def format_media(m):
    return {
        'id': m['id'],
        'idMal': m.get('idMal'),
        'title': m.get('title', {}),
        'description': m.get('description'),
        'coverImage': m.get('coverImage', {}),
        'bannerImage': m.get('bannerImage'),
        'format': m.get('format'),
        'status': m.get('status'),
        'episodes': m.get('episodes'),
        'duration': m.get('duration'),
        'season': m.get('season'),
        'seasonYear': m.get('seasonYear'),
        'genres': m.get('genres', []),
        'tags': [t['name'] for t in (m.get('tags') or [])],
        'averageScore': m.get('averageScore'),
        'meanScore': m.get('meanScore'),
        'popularity': m.get('popularity'),
        'trending': m.get('trending'),
        'favourites': m.get('favourites'),
        'startDate': m.get('startDate'),
        'endDate': m.get('endDate'),
        'nextAiringEpisode': m.get('nextAiringEpisode'),
        'studios': [
            {'id': e['node']['id'], 'name': e['node']['name'], 'isMain': e['isMain']}
            for e in (m.get('studios', {}).get('edges') or [])
        ],
        'trailer': m.get('trailer'),
        'rankings': m.get('rankings', []),
    }


@app.route('/')
def home():
    return jsonify({
        'name': 'Miruro Anime API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': [
            'GET /api/trending',
            'GET /api/popular',
            'GET /api/top',
            'GET /api/seasonal?season=SPRING&year=2026',
            'GET /api/schedule?day=MONDAY',
            'GET /api/airing',
            'GET /api/search?query=naruto&sort=SCORE_DESC&page=1',
            'GET /api/info/<id>',
            'GET /api/info/<id>/episodes',
            'GET /api/characters/<id>',
            'GET /api/recommendations/<id>',
            'GET /api/genres',
        ],
    })


@app.route('/api/trending')
def trending():
    limit = request.args.get('limit', 20, type=int)
    query = f'query {{ Page(perPage: {limit}) {{ media(sort: TRENDING_DESC, type: ANIME) {{ {MEDIA_FIELDS} }} }} }}'
    data = anilist_query(query)
    return jsonify({'success': True, 'data': [format_media(m) for m in data['Page']['media']]})


@app.route('/api/popular')
def popular():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    query = f'query {{ Page(page: {page}, perPage: {limit}) {{ media(sort: POPULARITY_DESC, type: ANIME) {{ {MEDIA_FIELDS} }} pageInfo {{ total currentPage lastPage perPage }} }} }}'
    data = anilist_query(query)
    return jsonify({
        'success': True,
        'data': [format_media(m) for m in data['Page']['media']],
        'pagination': data['Page']['pageInfo'],
    })


@app.route('/api/top')
def top():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    query = f'query {{ Page(page: {page}, perPage: {limit}) {{ media(sort: SCORE_DESC, type: ANIME) {{ {MEDIA_FIELDS} }} pageInfo {{ total currentPage lastPage perPage }} }} }}'
    data = anilist_query(query)
    return jsonify({
        'success': True,
        'data': [format_media(m) for m in data['Page']['media']],
        'pagination': data['Page']['pageInfo'],
    })


@app.route('/api/seasonal')
def seasonal():
    season = request.args.get('season', 'SPRING').upper()
    year = request.args.get('year', 2026, type=int)
    limit = request.args.get('limit', 20, type=int)
    query = f'''query ($season: MediaSeason, $seasonYear: Int) {{
      Page(perPage: {limit}) {{
        media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME) {{ {MEDIA_FIELDS} }}
      }}
    }}'''
    data = anilist_query(query, {'season': season, 'seasonYear': year})
    return jsonify({'success': True, 'season': season, 'year': year, 'data': [format_media(m) for m in data['Page']['media']] })


@app.route('/api/schedule')
def schedule():
    day = request.args.get('day', '').upper()
    query = f'''query {{
      Page(perPage: 50) {{
        media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) {{
          id
          title {{ romaji english native userPreferred }}
          coverImage {{ large medium color }}
          nextAiringEpisode {{ episode timeUntilAiring airingAt }}
        }}
      }}
    }}'''
    data = anilist_query(query)
    episodes = []
    for m in data['Page']['media']:
        if not m.get('nextAiringEpisode'):
            continue
        ep = m['nextAiringEpisode']
        air_date = time.gmtime(ep['airingAt'])
        dow = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
        entry = {
            'id': m['id'],
            'title': m['title']['userPreferred'],
            'coverImage': m.get('coverImage', {}).get('large'),
            'nextEpisode': ep['episode'],
            'airingAt': ep['airingAt'],
            'dayOfWeek': dow[air_date.tm_wday],
            'timeUntilAiring': ep['timeUntilAiring'],
        }
        if day and dow[air_date.tm_wday] != day:
            continue
        episodes.append(entry)
    episodes.sort(key=lambda x: x['airingAt'])
    return jsonify({'success': True, 'data': episodes})


@app.route('/api/airing')
def airing():
    query = f'''query {{
      Page(perPage: 25) {{
        media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) {{
          id
          title {{ romaji english native userPreferred }}
          coverImage {{ large medium color }}
          bannerImage
          format
          episodes
          averageScore
          nextAiringEpisode {{ episode timeUntilAiring airingAt }}
        }}
      }}
    }}'''
    data = anilist_query(query)
    result = []
    for m in data['Page']['media']:
        if not m.get('nextAiringEpisode'):
            continue
        result.append({
            'id': m['id'],
            'title': m['title']['userPreferred'],
            'coverImage': m.get('coverImage', {}).get('large'),
            'bannerImage': m.get('bannerImage'),
            'format': m.get('format'),
            'episodes': m.get('episodes'),
            'averageScore': m.get('averageScore'),
            'nextEpisode': m['nextAiringEpisode']['episode'],
            'airingAt': m['nextAiringEpisode']['airingAt'],
            'timeUntilAiring': m['nextAiringEpisode']['timeUntilAiring'],
        })
    return jsonify({'success': True, 'data': result})


@app.route('/api/search')
def search():
    q = request.args.get('query', '')
    sort = request.args.get('sort', 'POPULARITY_DESC').upper()
    genre = request.args.get('genre', '')
    fmt = request.args.get('format', '').upper()
    status = request.args.get('status', '').upper()
    season = request.args.get('season', '').upper()
    year = request.args.get('year', '', type=str)
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    if not q and not genre:
        return jsonify({'success': False, 'error': 'query or genre parameter required'}), 400

    sort_map = {
        'SCORE_DESC': 'SCORE_DESC', 'POPULARITY_DESC': 'POPULARITY_DESC',
        'TRENDING_DESC': 'TRENDING_DESC', 'FAVOURITES_DESC': 'FAVOURITES_DESC',
        'START_DATE_DESC': 'START_DATE_DESC', 'UPDATED_AT_DESC': 'UPDATED_AT_DESC',
    }
    s = sort_map.get(sort, 'POPULARITY_DESC')

    filters = ''
    variables = {'search': q or None, 'sort': s, 'page': page, 'perPage': limit}
    if genre:
        filters += ', genre: $genre'
        variables['genre'] = genre
    if fmt:
        filters += ', format: $format'
        variables['format'] = fmt
    if status:
        filters += ', status: $status'
        variables['status'] = status
    if season:
        filters += ', season: $season'
        variables['season'] = season
    if year:
        filters += ', seasonYear: $seasonYear'
        variables['seasonYear'] = int(year)

    query = f'''query ($search: String, $sort: [MediaSort], $genre: String, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {{
      Page(page: $page, perPage: $perPage) {{
        media(search: $search, type: ANIME, sort: $sort{filters}) {{ {MEDIA_FIELDS} }}
        pageInfo {{ total currentPage lastPage perPage }}
      }}
    }}'''
    data = anilist_query(query, variables)
    return jsonify({
        'success': True,
        'data': [format_media(m) for m in data['Page']['media']],
        'pagination': data['Page']['pageInfo'],
    })


@app.route('/api/info/<int:anime_id>')
def info(anime_id):
    query = f'''query ($id: Int) {{
      Media(id: $id, type: ANIME) {{
        {MEDIA_FIELDS}
        relations {{
          edges {{
            node {{ id title {{ romaji english native userPreferred }} format coverImage {{ large medium }} }}
            relationType
          }}
        }}
        externalLinks {{ id site url type language }}
        streamingEpisodes {{ title thumbnail url site }}
      }}
    }}'''
    data = anilist_query(query, {'id': anime_id})
    if not data.get('Media'):
        return jsonify({'success': False, 'error': 'Anime not found'}), 404
    m = data['Media']
    result = format_media(m)
    result['relations'] = [
        {
            'id': e['node']['id'],
            'title': e['node']['title']['userPreferred'],
            'format': e['node']['format'],
            'coverImage': e['node']['coverImage'].get('large') if e['node'].get('coverImage') else None,
            'relationType': e['relationType'],
        }
        for e in (m.get('relations', {}).get('edges') or [])
    ]
    result['externalLinks'] = m.get('externalLinks') or []
    result['streamingEpisodes'] = m.get('streamingEpisodes') or []
    return jsonify({'success': True, 'data': result})


@app.route('/api/info/<int:anime_id>/episodes')
def episodes(anime_id):
    query = f'''query ($id: Int) {{
      Media(id: $id, type: ANIME) {{
        id
        title {{ romaji english native userPreferred }}
        episodes
        streamingEpisodes {{ title thumbnail url site }}
        externalLinks {{ id site url type }}
      }}
    }}'''
    data = anilist_query(query, {'id': anime_id})
    if not data.get('Media'):
        return jsonify({'success': False, 'error': 'Anime not found'}), 404
    m = data['Media']
    eps = []
    for i, ep in enumerate(m.get('streamingEpisodes') or []):
        eps.append({
            'number': i + 1,
            'title': ep.get('title'),
            'thumbnail': ep.get('thumbnail'),
            'url': ep.get('url'),
            'site': ep.get('site'),
        })
    return jsonify({
        'success': True,
        'animeId': m['id'],
        'title': m['title']['userPreferred'],
        'totalEpisodes': m.get('episodes'),
        'episodes': eps,
        'providers': ['kiwi', 'pewe', 'bee', 'bonk', 'bun', 'ally', 'nun', 'twin', 'cog', 'moo', 'hop'],
    })


@app.route('/api/characters/<int:anime_id>')
def characters(anime_id):
    query = f'''query ($id: Int) {{
      Media(id: $id, type: ANIME) {{
        id
        characters(sort: ROLE, perPage: 25) {{
          edges {{
            node {{ id name {{ full native alternative }} image {{ large medium }} gender age bloodType }}
            role
          }}
        }}
      }}
    }}'''
    data = anilist_query(query, {'id': anime_id})
    if not data.get('Media'):
        return jsonify({'success': False, 'error': 'Anime not found'}), 404
    return jsonify({
        'success': True,
        'animeId': data['Media']['id'],
        'characters': [
            {
                'id': e['node']['id'],
                'name': e['node']['name'],
                'image': e['node']['image'],
                'role': e['role'],
                'gender': e['node'].get('gender'),
                'age': e['node'].get('age'),
                'bloodType': e['node'].get('bloodType'),
            }
            for e in data['Media']['characters']['edges']
        ],
    })


@app.route('/api/recommendations/<int:anime_id>')
def recommendations(anime_id):
    query = f'''query ($id: Int) {{
      Media(id: $id, type: ANIME) {{
        id
        recommendations(perPage: 10, sort: RATING_DESC) {{
          edges {{
            node {{
              id rating
              mediaRecommendation {{
                id
                title {{ romaji english native userPreferred }}
                coverImage {{ large medium color }}
                format episodes averageScore popularity
              }}
            }}
          }}
        }}
      }}
    }}'''
    data = anilist_query(query, {'id': anime_id})
    if not data.get('Media'):
        return jsonify({'success': False, 'error': 'Anime not found'}), 404
    return jsonify({
        'success': True,
        'animeId': data['Media']['id'],
        'recommendations': [
            {
                'id': e['node']['mediaRecommendation']['id'],
                'title': e['node']['mediaRecommendation']['title']['userPreferred'],
                'coverImage': e['node']['mediaRecommendation']['coverImage'].get('large'),
                'format': e['node']['mediaRecommendation']['format'],
                'episodes': e['node']['mediaRecommendation']['episodes'],
                'averageScore': e['node']['mediaRecommendation']['averageScore'],
                'rating': e['node']['rating'],
            }
            for e in data['Media']['recommendations']['edges']
        ],
    })


@app.route('/api/genres')
def genres():
    data = anilist_query('{ GenreCollection }')
    return jsonify({'success': True, 'data': data['GenreCollection']})


if __name__ == '__main__':
    print('\n  🎬 Miruro Anime API running on http://localhost:3000\n')
    print('  Endpoints:')
    print('    GET /api/trending')
    print('    GET /api/popular')
    print('    GET /api/top')
    print('    GET /api/seasonal?season=SPRING&year=2026')
    print('    GET /api/schedule?day=MONDAY')
    print('    GET /api/airing')
    print('    GET /api/search?query=naruto')
    print('    GET /api/info/<id>')
    print('    GET /api/info/<id>/episodes')
    print('    GET /api/characters/<id>')
    print('    GET /api/recommendations/<id>')
    print('    GET /api/genres\n')
    app.run(host='0.0.0.0', port=3000, debug=True)
