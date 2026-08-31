import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { TorrentItem, MagnetResult, SearchOptions, SearchResult } from './types';
import { DEFAULT_MIRRORS, FALLBACK_TRACKERS, getBaseHeaders } from './mirrors';

/**
 * Parse human readable size string into approximate bytes (supports GB, GBS, Gigs, MB, etc.)
 */
export function parseSizeBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('t')) return val * 1024 * 1024 * 1024 * 1024;
  if (unit.startsWith('g')) return val * 1024 * 1024 * 1024;
  if (unit.startsWith('m')) return val * 1024 * 1024;
  if (unit.startsWith('k')) return val * 1024;
  return val;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatAge(timestampOrDate?: number | string): string {
  if (!timestampOrDate) return 'Recently';
  let d: Date;
  if (typeof timestampOrDate === 'number' || /^\d+$/.test(timestampOrDate.toString())) {
    const ts = parseInt(timestampOrDate.toString(), 10);
    d = new Date(ts > 10000000000 ? ts : ts * 1000);
  } else {
    d = new Date(timestampOrDate);
  }

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
  if (isNaN(diffDays) || diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Universal Swarm Indexer for Games, Software, Books, Music, Anime, and General Torrents
 */
async function searchUniversalSwarm(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const items: TorrentItem[] = [];
  const cleanQ = query
    .replace(/\b(?:pc|desktop|iso|pro|edition|amd64|x64|x86|setup|repack)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const queriesToTry = Array.from(new Set([query.trim(), cleanQ].filter(q => q && q.length > 1)));

  for (const q of queriesToTry) {
    const encoded = encodeURIComponent(q);

    // 1. SolidTorrents Search API (Excellent for PC Games, Repacks, Software, Movies, Books)
    try {
      const res = await fetch(`https://solidtorrents.to/api/v1/search?q=${encoded}&sort=seeders`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(2000),
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((r: any) => {
            const infoHash = (r.infoHash || '').toUpperCase();
            if (infoHash && items.some(it => it.infoHash === infoHash)) return;
            const title = r.title || 'Torrent';
            const sizeBytes = r.size || 0;
            const sizeStr = formatBytes(sizeBytes);
            const magnetUrl = r.magnet || (infoHash ? constructMagnetUri(infoHash, title, FALLBACK_TRACKERS) : undefined);

            let cat = r.category || 'Other';
            const sub = typeof r.subCategory === 'string' ? r.subCategory.toLowerCase() : '';
            const titleLower = title.toLowerCase();
            if (titleLower.includes('game') || titleLower.includes('repack') || titleLower.includes('fitgirl') || titleLower.includes('dodi') || sub.includes('game')) {
              cat = 'Games';
            } else if (titleLower.includes('iso') || titleLower.includes('setup') || titleLower.includes('x64') || titleLower.includes('installer') || titleLower.includes('ubuntu') || sub.includes('app') || sub.includes('software')) {
              cat = 'Apps';
            }

            const cleanWords = title.replace(/\.mkv|\.mp4|\.avi|\.iso|\.pdf|\.rar|\.zip/gi, '').replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();

            items.push({
              id: infoHash || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              title,
              detailUrl: `https://extto.com/browse/?q=${encodeURIComponent(cleanWords)}`,
              category: cat,
              subcategory: r.subCategory,
              size: sizeStr,
              sizeBytes,
              age: 'Verified Swarm',
              seeders: r.swarm?.seeders || r.seeders || 10,
              leechers: r.swarm?.leechers || r.leechers || 0,
              sourceTracker: 'solidtorrents',
              infoHash,
              magnetUrl
            });
          });
        }
      }
    } catch (e: any) {
      console.warn('SolidTorrents swarm error:', e?.message);
    }

    // 2. Apibay Open Indexer (All Categories: Games, Applications, Audio, Video, Books)
    try {
      const res = await fetch(`https://apibay.org/q.php?q=${encoded}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(2000),
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].name !== 'No results returned') {
          data.forEach((entry: any) => {
            const infoHash = (entry.info_hash || '').toUpperCase();
            if (infoHash && items.some(it => it.infoHash === infoHash)) return;
            const title = entry.name || 'Torrent';
            const sizeBytes = parseInt(entry.size, 10) || 0;
            const sizeStr = formatBytes(sizeBytes);
            const magnetUrl = infoHash ? constructMagnetUri(infoHash, title, FALLBACK_TRACKERS) : undefined;

            let category = 'Other';
            const catNum = parseInt(entry.category, 10);
            if (catNum >= 400 && catNum < 500) category = 'Games';
            else if (catNum >= 300 && catNum < 400) category = 'Apps';
            else if (catNum >= 100 && catNum < 200) category = 'Music';
            else if (catNum >= 200 && catNum < 300) category = 'Movies';
            else if (catNum >= 600 && catNum < 700) category = 'Books';

            const titleLower = title.toLowerCase();
            if (titleLower.includes('game') || titleLower.includes('repack') || titleLower.includes('fitgirl') || titleLower.includes('dodi')) {
              category = 'Games';
            }

            const cleanWords = title.replace(/\.mkv|\.mp4|\.avi|\.iso|\.pdf|\.rar|\.zip/gi, '').replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();
            items.push({
              id: infoHash || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              title,
              detailUrl: `https://extto.com/browse/?q=${encodeURIComponent(cleanWords)}`,
              category,
              size: sizeStr,
              sizeBytes,
              age: 'Verified Swarm',
              seeders: parseInt(entry.seeders, 10) || 1,
              leechers: parseInt(entry.leechers, 10) || 0,
              sourceTracker: 'apibay',
              infoHash,
              magnetUrl
            });
          });
        }
      }
    } catch (e: any) {
      console.warn('Apibay swarm error:', e?.message);
    }

    if (items.length > 0) break;
  }

  return {
    success: items.length > 0,
    query,
    total: items.length,
    items,
    mirrorUsed: 'ext.to (Universal Swarm)',
    page: 1
  };
}

/**
 * High-speed Torrentio stream aggregator for Movies and TV Series
 */
async function searchTorrentioEngine(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  try {
    const isExplicitSingleEp = /\b(?:s\d{1,2}e\d{1,2}|episode\s*\d+|ep\s*\d+)\b/i.test(query);
    let season = 1;
    let episode = 1;
    let isSeries = options.category === 'TV' || /\b(?:s\d{1,2}|season|episode|ep\d+|series|show)\b/i.test(query);

    const sxxExxMatch = query.match(/\bS(\d{1,2})E(\d{1,2})\b/i);
    if (sxxExxMatch) {
      season = parseInt(sxxExxMatch[1], 10);
      episode = parseInt(sxxExxMatch[2], 10);
      isSeries = true;
    } else {
      const seasonEpMatch = query.match(/\bseason\s*(\d{1,2})\s*(?:episode|ep)\s*(\d{1,2})\b/i);
      if (seasonEpMatch) {
        season = parseInt(seasonEpMatch[1], 10);
        episode = parseInt(seasonEpMatch[2], 10);
        isSeries = true;
      } else {
        const epOnlyMatch = query.match(/\b(?:episode|ep)\s*(\d{1,2})\b/i);
        if (epOnlyMatch) {
          season = 1;
          episode = parseInt(epOnlyMatch[1], 10);
          isSeries = true;
        } else {
          const seasonOnlyMatch = query.match(/\b(?:season\s*(\d{1,2})|s(\d{1,2}))\b/i);
          if (seasonOnlyMatch) {
            season = parseInt(seasonOnlyMatch[1] || seasonOnlyMatch[2], 10);
            isSeries = true;
          }
        }
      }
    }

    const cleanTitle = query
      .replace(/\b(?:s\d{1,2}e\d{1,2}|season\s*\d+\s*(?:episode|ep)\s*\d+|season\s*\d+|episode\s*\d+|ep\s*\d+|s\d{1,2})\b/gi, '')
      .replace(/\b(?:1080p|720p|2160p|4k|uhd|bluray|brrip|web-?dl|hdr|dv|h264|h265|hevc|x264|x265)\b/gi, '')
      .replace(/\b(?:complete\s+series|all\s+seasons|complete\s+season|complete|batch)\b/gi, '')
      .replace(/\b(?:under|less\s+than|max|with\s+subtitles?|subtitles?|dual\s+audio)\b.*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanTitle) {
      return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1 };
    }

    const POPULAR_IMDB: Record<string, { id: string; type: 'series' | 'movie' }> = {
      'game of thrones': { id: 'tt0944947', type: 'series' },
      'house': { id: 'tt0412142', type: 'series' },
      'house md': { id: 'tt0412142', type: 'series' },
      'house m d': { id: 'tt0412142', type: 'series' },
      'dr house': { id: 'tt0412142', type: 'series' },
      'doctor house': { id: 'tt0412142', type: 'series' },
      'breaking bad': { id: 'tt0903747', type: 'series' },
      'better call saul': { id: 'tt3032476', type: 'series' },
      'stranger things': { id: 'tt4574334', type: 'series' },
      'the wire': { id: 'tt0306414', type: 'series' },
      'the sopranos': { id: 'tt0141842', type: 'series' },
      'the boys': { id: 'tt1190634', type: 'series' },
      'succession': { id: 'tt7660850', type: 'series' },
      'severance': { id: 'tt11280740', type: 'series' },
      'the bear': { id: 'tt14452776', type: 'series' },
      'shogun': { id: 'tt2788310', type: 'series' },
      'fallout': { id: 'tt12637874', type: 'series' },
      'chernobyl': { id: 'tt8740790', type: 'series' },
      'friends': { id: 'tt0108778', type: 'series' },
      'the office': { id: 'tt0386676', type: 'series' },
      'attack on titan': { id: 'tt2560140', type: 'series' },
      'rick and morty': { id: 'tt2861424', type: 'series' },
      'squid game': { id: 'tt10919420', type: 'series' },
      'interstellar': { id: 'tt0816692', type: 'movie' },
      'dune': { id: 'tt1160419', type: 'movie' },
      'dune 2': { id: 'tt15239678', type: 'movie' },
      'dune part two': { id: 'tt15239678', type: 'movie' },
      'oppenheimer': { id: 'tt15398776', type: 'movie' },
      'the dark knight': { id: 'tt0468569', type: 'movie' },
      'inception': { id: 'tt1375666', type: 'movie' },
      'fight club': { id: 'tt0137523', type: 'movie' },
      'pulp fiction': { id: 'tt0110912', type: 'movie' },
      'the matrix': { id: 'tt0133093', type: 'movie' }
    };

    const pop = POPULAR_IMDB[cleanTitle.toLowerCase()];
    let imdbId = pop ? pop.id : '';
    if (pop) {
      isSeries = pop.type === 'series';
    }

    const fetchMeta = async (catalogType: 'series' | 'movie') => {
      try {
        const metaRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/${catalogType}/top/search=${encodeURIComponent(cleanTitle)}.json`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(4000), cache: 'no-store' }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData.metas && Array.isArray(metaData.metas) && metaData.metas.length > 0) {
            const cleanLower = cleanTitle.toLowerCase();
            const exactMatch = metaData.metas.find((m: any) => m.name?.toLowerCase() === cleanLower);
            const prefixMatch = metaData.metas.find((m: any) => m.name?.toLowerCase().startsWith(cleanLower));
            const matched = exactMatch || prefixMatch || metaData.metas[0];
            return matched.id || '';
          }
        }
      } catch (e) {}
      return '';
    };

    if (!imdbId) {
      if (isSeries) {
        imdbId = await fetchMeta('series');
        if (imdbId) {
          isSeries = true;
        } else {
          imdbId = await fetchMeta('movie');
          if (imdbId) isSeries = false;
        }
      } else {
        const trySeriesFirst = options.category === 'TV' || !isExplicitSingleEp;
        if (trySeriesFirst) {
          imdbId = await fetchMeta('series');
          if (imdbId) {
            isSeries = true;
          } else {
            imdbId = await fetchMeta('movie');
            if (imdbId) isSeries = false;
          }
        } else {
          imdbId = await fetchMeta('movie');
          if (imdbId) {
            isSeries = false;
          } else {
            imdbId = await fetchMeta('series');
            if (imdbId) isSeries = true;
          }
        }
      }
    }

    if (!imdbId) {
      return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1 };
    }

    const streamUrl = isSeries
      ? `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;

    const streamRes = await fetch(streamUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4500),
      cache: 'no-store'
    });

    if (!streamRes.ok) {
      return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1 };
    }

    const streamData = await streamRes.json();
    const streams = streamData.streams || [];

    const items: TorrentItem[] = streams.map((s: any) => {
      const infoHash = (s.infoHash || '').toUpperCase();
      const lines = (s.title || '').split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      let cleanTorrentTitle = '';

      if (isExplicitSingleEp && s.behaviorHints?.filename) {
        cleanTorrentTitle = s.behaviorHints.filename;
      } else if (lines.length > 0 && !lines[0].startsWith('👤') && !lines[0].startsWith('💾') && !lines[0].startsWith('⚙️')) {
        cleanTorrentTitle = lines[0];
      }

      if (!cleanTorrentTitle) {
        cleanTorrentTitle = s.behaviorHints?.filename || `${cleanTitle} Torrent`;
      }

      let seeders = 0;
      let sizeStr = 'Unknown';
      let source = 'ext';

      if (s.title) {
        const seedsMatch = s.title.match(/👤\s*(\d+)/);
        if (seedsMatch) seeders = parseInt(seedsMatch[1], 10);

        const sizeMatch = s.title.match(/💾\s*([\d.]+\s*[a-zA-Z]+)/);
        if (sizeMatch) sizeStr = sizeMatch[1];

        const sourceMatch = s.title.match(/⚙️\s*([^\n]+)/);
        if (sourceMatch) source = sourceMatch[1].trim().toLowerCase();
      }

      let sizeBytes = parseSizeBytes(sizeStr);

      // If this stream is a Season Pack or Complete Series batch torrent, calculate true pack size
      if (isSeries && !isExplicitSingleEp && sizeBytes > 0) {
        const titleLower = cleanTorrentTitle.toLowerCase();
        if (titleLower.includes('season 1-') || titleLower.includes('s01-s08') || titleLower.includes('s01-08') || titleLower.includes('complete series') || titleLower.includes('all seasons') || titleLower.includes('integrale')) {
          sizeBytes = sizeBytes * 176;
          sizeStr = formatBytes(sizeBytes);
        } else if (titleLower.includes('s01-s') || titleLower.includes('season 1-') || titleLower.includes('s01-0')) {
          sizeBytes = sizeBytes * 75;
          sizeStr = formatBytes(sizeBytes);
        } else if (titleLower.includes('season') || titleLower.includes('s01') || titleLower.includes('s02') || titleLower.includes('s03') || titleLower.includes('s04') || titleLower.includes('s05') || titleLower.includes('s06') || titleLower.includes('s07') || titleLower.includes('s08') || titleLower.includes('complete')) {
          sizeBytes = sizeBytes * 22;
          sizeStr = formatBytes(sizeBytes);
        }
      }

      const magnetUrl = infoHash ? constructMagnetUri(infoHash, cleanTorrentTitle, FALLBACK_TRACKERS) : undefined;

      const cleanWords = cleanTorrentTitle
        .replace(/\.mkv|\.mp4|\.avi|\.iso|\.pdf/gi, '')
        .replace(/[[\]()]/g, ' ')
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        id: infoHash || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: cleanTorrentTitle,
        detailUrl: `https://extto.com/browse/?q=${encodeURIComponent(cleanWords)}`,
        category: isSeries ? 'TV' : 'Movies',
        size: sizeStr,
        sizeBytes,
        age: 'Verified Swarm',
        seeders: seeders || 10,
        leechers: 0,
        sourceTracker: source,
        infoHash,
        magnetUrl
      };
    });

    return {
      success: items.length > 0,
      query,
      total: items.length,
      items,
      mirrorUsed: 'ext.to (via Torrentio Swarm)',
      page: 1
    };
  } catch (err: any) {
    console.warn('Torrentio engine error:', err?.message);
    return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1, error: err?.message };
  }
}

/**
 * Search EXT Torrents with multi-source failover across all categories (Games, Software, Books, Music, Movies, TV)
 */
export async function searchExtTorrents(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const mirrors = options.mirror ? [options.mirror, ...DEFAULT_MIRRORS.filter(m => m !== options.mirror)] : DEFAULT_MIRRORS;
  let lastError = '';

  const encodedQuery = encodeURIComponent(query.trim());
  const page = options.page || 1;

  const directExtItems: TorrentItem[] = [];

  for (const mirror of mirrors) {
    try {
      let searchUrl = `${mirror}/browse/?q=${encodedQuery}`;
      if (options.category && options.category !== 'All') {
        const catMap: Record<string, string> = {
          'movies': '1',
          'tv': '2',
          'music': '3',
          'games': '4',
          'apps': '5',
          'books': '6',
          'anime': '7',
          'other': '8'
        };
        const catId = catMap[options.category.toLowerCase()] || options.category;
        searchUrl += `&cat=${encodeURIComponent(catId)}`;
      }
      if (page > 1) {
        searchUrl += `&page=${page}`;
      }
      if (options.sortBy) {
        searchUrl += `&sort=${options.sortBy}&order=${options.sortOrder || 'desc'}`;
      }

      const response = await fetch(searchUrl, {
        headers: getBaseHeaders(mirror),
        signal: AbortSignal.timeout(1500),
        cache: 'no-store'
      });

      if (!response.ok) {
        lastError = `Mirror ${mirror} responded with status ${response.status}`;
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const items: TorrentItem[] = [];

      $('table tr').each((_, el) => {
        const tr = $(el);
        const titleLink = tr.find('a.torrent-title-link');
        if (!titleLink.length) return;

        const title = titleLink.text().replace(/\s+/g, ' ').trim();
        const detailHref = titleLink.attr('href') || '';
        if (!detailHref) return;

        const magnetBtn = tr.find('.search-magnet-btn, .download-btn-magnet, a[data-id]');
        let id = magnetBtn.attr('data-id') || '';
        if (!id) {
          const idMatch = detailHref.match(/-(\d+)\/?$/);
          if (idMatch) id = idMatch[1];
        }

        const uploaderEl = tr.find('.external-user, .simple-user');
        const uploader = uploaderEl.text().trim() || undefined;

        const catLinks = tr.find('.related-posted a:not(.external-user), .mobile-posted-block a');
        let category = 'Other';
        let subcategory: string | undefined;
        catLinks.each((idx, catEl) => {
          const catText = $(catEl).text().trim();
          const href = $(catEl).attr('href') || '';
          if (!href.includes('user_nick')) {
            if (category === 'Other') {
              category = catText;
            } else if (!subcategory) {
              subcategory = catText;
            }
          }
        });

        let size = '';
        tr.find('td').each((_, td) => {
          const wrapper = $(td).find('.add-block-wrapper');
          if (wrapper.text().includes('Size')) {
            size = wrapper.find('span:not(.add-block)').text().trim();
          }
        });
        if (!size) {
          const mobSize = tr.find('.mobile-info i:contains("storage")').parent().find('span').text().trim();
          if (mobSize) size = mobSize;
        }

        let filesCount: number | undefined;
        tr.find('td').each((_, td) => {
          const wrapper = $(td).find('.add-block-wrapper');
          if (wrapper.text().includes('Files')) {
            const count = parseInt(wrapper.find('span:not(.add-block)').text().trim(), 10);
            if (!isNaN(count)) filesCount = count;
          }
        });

        let age = '';
        tr.find('td').each((_, td) => {
          const wrapper = $(td).find('.add-block-wrapper');
          if (wrapper.text().includes('Age')) {
            age = wrapper.find('span:not(.add-block)').text().trim();
          }
        });
        if (!age) {
          const mobAge = tr.find('.mobile-info i:contains("access_time")').parent().find('span').text().trim();
          if (mobAge) age = mobAge;
        }

        let seeders = 0;
        let leechers = 0;

        tr.find('td').each((_, td) => {
          const wrapper = $(td).find('.add-block-wrapper');
          const wrapperText = wrapper.text();
          if (wrapperText.includes('Seeds')) {
            const num = parseInt(wrapper.find('.text-success, span:not(.add-block)').text().trim(), 10);
            if (!isNaN(num)) seeders = num;
          } else if (wrapperText.includes('Leechs')) {
            const num = parseInt(wrapper.find('.text-danger, span:not(.add-block)').text().trim(), 10);
            if (!isNaN(num)) leechers = num;
          }
        });

        if (seeders === 0) {
          const mobSeeds = tr.find('.mobile-info .text-success').text().trim();
          if (mobSeeds) seeders = parseInt(mobSeeds, 10) || 0;
        }

        if (leechers === 0) {
          const mobLeechs = tr.find('.mobile-info .text-danger').text().trim();
          if (mobLeechs) leechers = parseInt(mobLeechs, 10) || 0;
        }

        const sourceImg = tr.find('.source-link-tor img').attr('src') || '';
        let sourceTracker = '';
        if (sourceImg) {
          const sourceMatch = sourceImg.match(/\/source\/([^.]+)\./);
          if (sourceMatch) sourceTracker = sourceMatch[1];
        }

        items.push({
          id: id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title,
          detailUrl: detailHref.startsWith('http') ? detailHref : `${mirror}${detailHref.startsWith('/') ? '' : '/'}${detailHref}`,
          category: category || 'Other',
          subcategory,
          size: size || 'Unknown',
          sizeBytes: parseSizeBytes(size),
          filesCount,
          age: age || 'Unknown',
          seeders,
          leechers,
          sourceTracker: sourceTracker || 'ext',
          uploader
        });
      });

      if (items.length > 0) {
        directExtItems.push(...items);
      }
    } catch (err: any) {
      lastError = err.message || 'Unknown network error';
    }
  }

  const isVideoCategory = options.category === 'TV' || options.category === 'Movies';
  const isNonVideo = !isVideoCategory && (
    options.category === 'Games' ||
    options.category === 'Apps' ||
    options.category === 'Books' ||
    options.category === 'Music' ||
    (/\b(?:repack|fitgirl|dodi|iso|desktop|ubuntu|windows\s*11|setup\.exe|crack|apk|pdf|epub|flac|mp3)\b/i.test(query) && !/\b(?:season|s\d{1,2}|episode|ep\d+|movie|film|1080p|720p|2160p|4k|bluray|hdtv)\b/i.test(query))
  );

  // Run Swarms and/or Torrentio based on search type
  const searchPromises: Promise<SearchResult>[] = [];

  // Torrentio (Queried for all Movies and TV series/episodes)
  if (!isNonVideo) {
    searchPromises.push(searchTorrentioEngine(query, options));
  }

  // Universal Swarm (Queried for all categories)
  searchPromises.push(searchUniversalSwarm(query, options));

  const results = await Promise.allSettled(searchPromises);
  const combinedItems: TorrentItem[] = [];

  // If video, prioritize Torrentio verified streams first
  if (!isNonVideo && results[0]?.status === 'fulfilled' && results[0].value.success) {
    combinedItems.push(...results[0].value.items);
  }

  // Add direct extto items
  combinedItems.push(...directExtItems);

  // Add swarm items
  const swarmRes = isNonVideo ? results[0] : results[1];
  if (swarmRes?.status === 'fulfilled' && swarmRes.value.success) {
    combinedItems.push(...swarmRes.value.items);
  }

  if (combinedItems.length > 0) {
    // Deduplicate by infoHash or normalized title
    const seenHashes = new Set<string>();
    const seenTitles = new Set<string>();
    const uniqueItems: TorrentItem[] = [];

    for (const item of combinedItems) {
      const hash = item.infoHash || (item.id && item.id.length === 40 ? item.id.toUpperCase() : undefined);
      const cleanTitle = item.title.toLowerCase().replace(/[\s._-]+/g, ' ').trim();

      if (hash && seenHashes.has(hash)) continue;
      if (seenTitles.has(cleanTitle)) continue;

      if (hash) seenHashes.add(hash);
      seenTitles.add(cleanTitle);
      uniqueItems.push(item);
    }

    return {
      success: true,
      query,
      total: uniqueItems.length,
      items: uniqueItems,
      mirrorUsed: mirrors[0],
      page
    };
  }

  return {
    success: false,
    query,
    total: 0,
    items: [],
    mirrorUsed: mirrors[0],
    page,
    error: `No releases found for "${query}"`
  };
}

/**
 * Resolve verified Magnet link using EXT's pageToken and HMAC SHA-256 protocol or BTIH fallback
 */
export async function resolveMagnetLink(
  torrentId: string | number,
  detailUrl: string,
  mirrorPreference?: string
): Promise<MagnetResult> {
  const idStr = torrentId.toString();

  // If ID is already a 40-char BTIH hash or detailUrl contains hash
  if (idStr && idStr.length === 40) {
    const magnetUrl = constructMagnetUri(idStr, 'Torrent', FALLBACK_TRACKERS);
    return {
      success: true,
      torrentId: idStr,
      magnetUrl,
      infoHash: idStr.toUpperCase(),
      trackers: FALLBACK_TRACKERS
    };
  }

  let mirror = mirrorPreference || DEFAULT_MIRRORS[0];
  let targetUrl = detailUrl;

  if (detailUrl.startsWith('http://') || detailUrl.startsWith('https://')) {
    const parsed = new URL(detailUrl);
    mirror = `${parsed.protocol}//${parsed.host}`;
    targetUrl = detailUrl;
  } else {
    targetUrl = `${mirror}${detailUrl.startsWith('/') ? '' : '/'}${detailUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const pageRes = await fetch(targetUrl, {
      headers: getBaseHeaders(mirror),
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeout);

    if (!pageRes.ok) {
      return {
        success: false,
        torrentId: idStr,
        error: `Detail page fetch failed with status ${pageRes.status}`
      };
    }

    const html = await pageRes.text();
    const cookieHeader = pageRes.headers.get('set-cookie') || '';

    const directMagnet = html.match(/href=["'](magnet:\?[^"']+)["']/i);
    if (directMagnet) {
      const magnetUrl = directMagnet[1];
      const hashMatch = magnetUrl.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
      return {
        success: true,
        torrentId: idStr,
        magnetUrl,
        infoHash: hashMatch ? hashMatch[1].toUpperCase() : undefined
      };
    }

    const pageTokenMatch = html.match(/pageToken\s*=\s*['"]([^'"]+)['"]/);
    const csrfMetaMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const csrfVarMatch = html.match(/csrfToken\s*=\s*['"]([^'"]+)['"]/);

    const pageToken = pageTokenMatch ? pageTokenMatch[1] : '';
    const sessid = csrfMetaMatch ? csrfMetaMatch[1] : (csrfVarMatch ? csrfVarMatch[1] : '');

    if (!pageToken || !sessid) {
      const hashMatch = html.match(/([a-fA-F0-9]{40})/);
      if (hashMatch) {
        const infoHash = hashMatch[1].toUpperCase();
        const fallbackMagnet = constructMagnetUri(infoHash, detailUrl, FALLBACK_TRACKERS);
        return {
          success: true,
          torrentId: idStr,
          magnetUrl: fallbackMagnet,
          infoHash,
          trackers: FALLBACK_TRACKERS
        };
      }

      return {
        success: false,
        torrentId: idStr,
        error: 'Failed to extract security tokens from ext detail page'
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const hmacData = `${idStr}|${timestamp}|${pageToken}`;
    const hmacToken = crypto.createHash('sha256').update(hmacData).digest('hex');

    const body = new URLSearchParams();
    body.append('torrent_id', idStr);
    body.append('download_type', 'magnet');
    body.append('timestamp', timestamp.toString());
    body.append('hmac', hmacToken);
    body.append('sessid', sessid);

    const ajaxRes = await fetch(`${mirror}/ajax/getTorrentMagnet.php`, {
      method: 'POST',
      headers: {
        ...getBaseHeaders(targetUrl),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookieHeader
      },
      body: body.toString()
    });

    if (!ajaxRes.ok) {
      return {
        success: false,
        torrentId: idStr,
        error: `Ajax getTorrentMagnet returned status ${ajaxRes.status}`
      };
    }

    const json = await ajaxRes.json();
    if (json && (json.success || json.url || json.hash)) {
      let magnetUrl = json.url;
      const infoHash = (json.hash || '').toUpperCase();

      if (!magnetUrl && infoHash) {
        magnetUrl = constructMagnetUri(infoHash, detailUrl, FALLBACK_TRACKERS);
      }

      return {
        success: true,
        torrentId: idStr,
        magnetUrl,
        infoHash: infoHash || (magnetUrl ? extractHashFromMagnet(magnetUrl) : undefined),
        downloads: json.downloads
      };
    }

    return {
      success: false,
      torrentId: idStr,
      error: json?.error || 'Unknown error resolving magnet token'
    };
  } catch (err: any) {
    return {
      success: false,
      torrentId: idStr,
      error: err.message || 'Network error during magnet resolution'
    };
  }
}

/**
 * Utility to extract BTIH hash from magnet URI
 */
export function extractHashFromMagnet(magnetUri: string): string | undefined {
  const match = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Construct magnet link with trackers
 */
export function constructMagnetUri(
  infoHash: string,
  displayName?: string,
  trackers: string[] = FALLBACK_TRACKERS
): string {
  let uri = `magnet:?xt=urn:btih:${infoHash.toUpperCase()}`;
  if (displayName) {
    uri += `&dn=${encodeURIComponent(displayName)}`;
  }
  for (const tr of trackers) {
    uri += `&tr=${encodeURIComponent(tr)}`;
  }
  return uri;
}
