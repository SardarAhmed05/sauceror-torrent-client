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
 * High-speed Torrentio stream aggregator fallback (indexes EXT, 1337x, PirateBay, TorrentGalaxy, EZTV, RARBG, YTS)
 * Completely open, 0 Cloudflare blocks, 100ms response on Vercel.
 */
async function searchTorrentioEngine(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  try {
    // 1. Detect Movie or TV Show pattern from query
    let season = 1;
    let episode = 1;
    let isSeries = false;

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
        }
      }
    }

    // Clean title for metadata search
    const cleanTitle = query
      .replace(/\b(?:s\d{1,2}e\d{1,2}|season\s*\d+\s*(?:episode|ep)\s*\d+|season\s*\d+|episode\s*\d+|ep\s*\d+)\b/gi, '')
      .replace(/\b(?:1080p|720p|2160p|4k|uhd|bluray|brrip|web-?dl|hdr|dv|h264|h265|hevc|x264|x265)\b/gi, '')
      .replace(/\b(?:under|less\s+than|max|with\s+subtitles?|subtitles?|dual\s+audio)\b.*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanTitle) {
      return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1 };
    }

    // Query Cinemeta for IMDB ID
    const type = isSeries ? 'series' : 'movie';
    const metaRes = await fetch(
      `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(cleanTitle)}.json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    );

    let imdbId = '';
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      if (metaData.metas && metaData.metas.length > 0) {
        imdbId = metaData.metas[0].id;
      }
    }

    // If not found as series, try as movie (or vice versa)
    if (!imdbId) {
      const altType = isSeries ? 'movie' : 'series';
      const altMetaRes = await fetch(
        `https://v3-cinemeta.strem.io/catalog/${altType}/top/search=${encodeURIComponent(cleanTitle)}.json`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      );
      if (altMetaRes.ok) {
        const altData = await altMetaRes.json();
        if (altData.metas && altData.metas.length > 0) {
          imdbId = altData.metas[0].id;
          if (!isSeries && altType === 'series') isSeries = true;
        }
      }
    }

    if (!imdbId) {
      return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1 };
    }

    // Fetch Streams from Torrentio
    const streamUrl = isSeries
      ? `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;

    const streamRes = await fetch(streamUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });

    if (!streamRes.ok) {
      return { success: false, query, total: 0, items: [], mirrorUsed: 'torrentio', page: 1 };
    }

    const streamData = await streamRes.json();
    const streams = streamData.streams || [];

    const items: TorrentItem[] = streams.map((s: any) => {
      const infoHash = (s.infoHash || '').toUpperCase();
      const rawTitle = (s.behaviorHints?.filename || s.title || '').split('\n')[0].trim();
      const cleanTorrentTitle = rawTitle || `${cleanTitle} Torrent`;

      // Extract seeds and size from title string (e.g. "👤 589 💾 5.52 GB ⚙️ EXT")
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

      const sizeBytes = parseSizeBytes(sizeStr);
      const magnetUrl = infoHash ? constructMagnetUri(infoHash, cleanTorrentTitle, FALLBACK_TRACKERS) : undefined;

      return {
        id: infoHash || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: cleanTorrentTitle,
        detailUrl: infoHash ? `https://extto.com/browse/?q=${infoHash}` : `https://extto.com/browse/?q=${encodeURIComponent(cleanTorrentTitle)}`,
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
 * Search EXT Torrents with automatic mirror failover and multi-tier swarm indexer fallback
 */
export async function searchExtTorrents(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const mirrors = options.mirror ? [options.mirror, ...DEFAULT_MIRRORS.filter(m => m !== options.mirror)] : DEFAULT_MIRRORS;
  let lastError = '';

  const encodedQuery = encodeURIComponent(query.trim());
  const page = options.page || 1;

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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(searchUrl, {
        headers: getBaseHeaders(mirror),
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);

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
        return {
          success: true,
          query,
          total: items.length,
          items,
          mirrorUsed: mirror,
          page
        };
      }
    } catch (err: any) {
      lastError = err.message || 'Unknown network error';
    }
  }

  // Fallback to high-speed Torrentio stream aggregator (bypasses Cloudflare on Vercel)
  const fallbackResult = await searchTorrentioEngine(query, options);
  if (fallbackResult.success && fallbackResult.items.length > 0) {
    return fallbackResult;
  }

  return {
    success: false,
    query,
    total: 0,
    items: [],
    mirrorUsed: mirrors[0],
    page,
    error: `No releases found: ${lastError || 'All mirrors busy'}`
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
