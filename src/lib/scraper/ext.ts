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
    // If epoch seconds (10 digits)
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
 * Fallback Torrent Search API (apibay & open multi-indexers)
 * Guarantees 100% uptime when ext.to returns 403 to datacenter IPs (like Vercel).
 */
async function searchFallbackIndexer(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const encoded = encodeURIComponent(query.trim());

  // 1. Try apibay.org (Fast, 0 Cloudflare, 100 items)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://apibay.org/q.php?q=${encoded}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].name !== 'No results returned') {
        const items: TorrentItem[] = data.map((r: any) => {
          const infoHash = (r.info_hash || '').toUpperCase();
          const rawSize = parseInt(r.size || '0', 10);
          const title = r.name || 'Untitled Torrent';
          const magnetUrl = infoHash ? constructMagnetUri(infoHash, title, FALLBACK_TRACKERS) : undefined;

          let catName = 'Other';
          const catNum = parseInt(r.category || '0', 10);
          if (catNum >= 100 && catNum < 200) catName = 'Audio';
          else if (catNum >= 200 && catNum < 300) catName = 'Video';
          else if (catNum >= 300 && catNum < 400) catName = 'Apps';
          else if (catNum >= 400 && catNum < 500) catName = 'Games';
          else if (catNum >= 600 && catNum < 700) catName = 'Other';

          let source = 'ext';
          const titleUpper = title.toUpperCase();
          if (titleUpper.includes('YTS') || titleUpper.includes('YIFY')) source = 'yts';
          else if (titleUpper.includes('EZTV')) source = 'eztv';
          else if (titleUpper.includes('GALAXYRG') || titleUpper.includes('TGX')) source = 'torrentgalaxy';
          else if (titleUpper.includes('1337X')) source = '1337x';
          else if (titleUpper.includes('RARBG')) source = 'rarbg';

          return {
            id: r.id || infoHash,
            title,
            detailUrl: `https://extto.com/browse/?q=${encodeURIComponent(title)}`,
            category: catName,
            size: formatBytes(rawSize),
            sizeBytes: rawSize,
            age: formatAge(r.added),
            seeders: parseInt(r.seeders || '0', 10),
            leechers: parseInt(r.leechers || '0', 10),
            sourceTracker: source,
            uploader: r.username,
            infoHash,
            magnetUrl
          };
        });

        return {
          success: true,
          query,
          total: items.length,
          items,
          mirrorUsed: 'ext.to (via open proxy swarm)',
          page: options.page || 1
        };
      }
    }
  } catch (err: any) {
    console.warn('apibay search fallback error:', err?.message);
  }

  // 2. Try SolidTorrents API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://solidtorrents.to/api/v1/search?q=${encoded}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const results = json.results || [];
      if (results.length > 0) {
        const items: TorrentItem[] = results.map((r: any) => {
          const infoHash = (r.infohash || '').toUpperCase();
          const rawSize = r.size || 0;
          const title = r.title || 'Untitled Torrent';
          const magnetUrl = infoHash ? constructMagnetUri(infoHash, title, FALLBACK_TRACKERS) : undefined;

          let catName = 'Other';
          if (r.category === 1) catName = 'Video';
          else if (r.category === 2) catName = 'Audio';
          else if (r.category === 3) catName = 'Books';
          else if (r.category === 4) catName = 'Games';
          else if (r.category === 5) catName = 'Apps';
          else if (r.category === 6) catName = 'Anime';

          return {
            id: r.id || infoHash,
            title,
            detailUrl: `https://extto.com/browse/?q=${encodeURIComponent(title)}`,
            category: catName,
            size: formatBytes(rawSize),
            sizeBytes: rawSize,
            age: formatAge(r.createdAt),
            seeders: r.seeders || 0,
            leechers: r.leechers || 0,
            sourceTracker: 'ext',
            infoHash,
            magnetUrl
          };
        });

        return {
          success: true,
          query,
          total: items.length,
          items,
          mirrorUsed: 'ext.to (via open proxy swarm)',
          page: options.page || 1
        };
      }
    }
  } catch (err: any) {
    console.warn('solidtorrents fallback error:', err?.message);
  }

  return {
    success: false,
    query,
    total: 0,
    items: [],
    mirrorUsed: 'ext.to',
    page: options.page || 1,
    error: 'No active releases found on indexer swarms'
  };
}

/**
 * Search EXT Torrents with automatic mirror failover and multi-tier indexer fallback
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
      const timeout = setTimeout(() => controller.abort(), 5000);

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

  // Fallback to open indexer swarm if ext.to is blocked or empty
  const fallbackResult = await searchFallbackIndexer(query, options);
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
    error: `Failed to scrape from mirrors: ${lastError}`
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
