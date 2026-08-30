import { searchExtTorrents, resolveMagnetLink } from '../scraper/ext';
import { TorrentItem } from '../scraper/types';
import { analyzeQueryWithGemini, synthesizeAgentResponse, QueryIntent } from './gemini';

export interface AgentRunResult {
  query: string;
  refinedQuery: string;
  coreTitle: string;
  category: string;
  intent: QueryIntent;
  items: TorrentItem[];
  topPick?: TorrentItem;
  summary: string;
  thoughts: string[];
  mirrorUsed: string;
}

/**
 * Detect if a release is a standalone movie (has year or movie tags, but no season/episode/series indicators)
 */
export function isMovieRelease(title: string): boolean {
  const lower = (title || '').toLowerCase();
  const hasSeasonOrEpisode = /\b(?:s\d{1,2}e\d{1,2}|season\s*\d+|s\d{1,2}\b|episode\s*\d+|ep\s*\d+|complete\s+series|all\s+seasons|complete\s+season|seasons\s*\d+|tv\s+series)\b/i.test(lower);
  if (hasSeasonOrEpisode) return false;

  const hasMovieTag = /\b(19\d{2}|20\d{2}|uncut|theatrical|yify|yts\.mx)\b/i.test(lower);
  return hasMovieTag;
}

/**
 * Normalize title strings, expanding common acronyms and roman numerals for accurate matching
 */
export function normalizeTitleForMatching(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/\.m\.d\b/gi, ' md')
    .replace(/\bm\.d\b/gi, ' md')
    .replace(/['":()[\]{}]/g, ' ')
    .replace(/[._-]/g, ' ')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\bgrand theft auto\b/gi, 'gta')
    .replace(/\bcall of duty\b/gi, 'cod')
    .replace(/\bred dead redemption\b/gi, 'rdr')
    .replace(/\bcounter strike\b/gi, 'cs')
    .replace(/\bv\b/gi, '5')
    .replace(/\biv\b/gi, '4')
    .replace(/\bvi\b/gi, '6')
    .replace(/\biii\b/gi, '3')
    .replace(/\bii\b/gi, '2')
    .replace(/\bi\b/gi, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strict check to ensure the torrent is for the actual requested title
 */
export function isStrictTitleMatch(itemTitle: string, targetTitle: string, alternateTitles?: string[]): boolean {
  if (!targetTitle || targetTitle.trim().length === 0) return true;

  const extraTargets: string[] = [];

  // Extract base title if target contains designations (like M.D.) or subtitle separators (: - – —)
  const strippedMd = targetTitle.replace(/\b(?:m\.?d\.?)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (strippedMd && strippedMd !== targetTitle) {
    extraTargets.push(strippedMd);
  }

  const beforeColon = targetTitle.split(/[:\-–—]/)[0].trim();
  if (beforeColon && beforeColon !== targetTitle) {
    extraTargets.push(beforeColon);
  }

  const targets = Array.from(new Set([targetTitle, ...(alternateTitles || []), ...extraTargets]));

  for (const target of targets) {
    const normItem = normalizeTitleForMatching(itemTitle);
    const normTarget = normalizeTitleForMatching(target);

    if (!normTarget) continue;
    if (normItem === normTarget) return true;

    // Torrent MUST start with target title (e.g. "house s01", "house 2004", "house md", "gta 5 reloaded", "ubuntu 24 04")
    if (normItem.startsWith(normTarget)) {
      const remainder = normItem.slice(normTarget.length).trim();
      if (!remainder) return true;

      const firstRemainderWord = remainder.split(/\s+/)[0];
      const isMetadataWord = /^(?:\d{4}|s\d{1,2}(?:e\d{1,2})?|season|seasons|episode|ep\d*|1080p|720p|2160p|4k|bluray|web|brrip|dvdrip|x264|x265|hevc|md|complete|batch|remux|h264|h265|repack|pilot|pc|game|games|iso|desktop|amd64|x64|x86|linux|windows|reloaded|fitgirl|dodi|elamigos|flt|rune|codex|skidrow|multi\d*|update|edition|v\d+.*|gta)$/i.test(firstRemainderWord);
      
      if (isMetadataWord) {
        return true;
      }
      continue;
    }
  }

  return false;
}

/**
 * Score a release based on swarm health, source reputation, format compatibility, size, and intent
 */
export function scoreRelease(
  item: TorrentItem,
  userQuery: string,
  maxSizeBytes?: number,
  intent: QueryIntent = 'movie'
): number {
  let score = 0;
  const title = (item.title || '').toLowerCase();
  const query = userQuery.toLowerCase();
  const rawSize = item.sizeBytes || 0;
  const seeds = item.seeders || 0;

  // 1. Seed health (logarithmic scale)
  score += Math.log10(Math.max(1, seeds)) * 30;

  // 2. Intent-Based Scoring
  if (intent === 'tv_season_pack') {
    const isSingleEp = /\b(?:s\d{1,2}e\d{1,2}|e\d{2}|episode\s*\d+|ep\s*\d+)\b/i.test(title);
    if (isSingleEp || rawSize < 1024 * 1024 * 1024) {
      score -= 500; // Overwhelming penalty so single episode files never beat full season packs
    }
    if (/\b(?:complete\s+series|all\s+seasons|the\s+complete\s+seasons|complete\s+season|complete|batch|full\s+season|s01-s\d+|season\s*\d+-\d+)\b/i.test(title)) {
      score += 150;
    }
    if (/\b(?:qxr|silence|vyndros|joy\s*\[utr\]|pophd|lostfilm|galaxytv|megusta|ethel|flux|psa|deejayahme)\b/i.test(title)) {
      score += 55;
    }
    if (rawSize >= 2 * 1024 * 1024 * 1024) {
      score += 50;
    }
  } else if (intent === 'tv_single_episode') {
    if (/\b(?:s\d{1,2}e\d{1,2}|episode\s*\d+|ep\s*\d+)\b/i.test(title)) {
      score += 80;
    }
    if (/\b(?:complete\s+series|all\s+seasons|s01-s\d+)\b/i.test(title) && rawSize > 10 * 1024 * 1024 * 1024) {
      score -= 60; // Penalize massive boxsets when user asked for one episode
    }
  } else if (intent === 'game') {
    if (/\b(?:fitgirl|dodi|elamigos|reloaded|flt|empress|skidrow|codex|rune)\b/i.test(title)) {
      score += 65;
    }
    if (/\b(?:repack|pc|crack|iso|installer)\b/i.test(title)) {
      score += 35;
    }
  } else if (intent === 'software') {
    if (/\b(?:iso|x64|installer|setup|portable|full|patch)\b/i.test(title)) {
      score += 45;
    }
  }

  // 3. High reputation gold-standard release groups (Movies & TV)
  if (/\b(?:yify|yts)\b/i.test(title)) score += 60;
  else if (/\b(?:galaxyrg|rarbg|psa|ethel|flux|killers|qxr|tigole)\b/i.test(title)) score += 50;

  // 4. Quality source format (BluRay / WEB-DL / Repack / ISO)
  if (/\b(?:bluray|brrip|bdrip|remux)\b/i.test(title)) score += 30;
  else if (/\b(?:web-?dl|webrip|amzn|hmax|dsnp|nf)\b/i.test(title)) score += 25;

  // 5. Codec & Platform compatibility
  if (/\b(?:x264|h264|avc)\b/i.test(title)) score += 25;
  else if (/\b(?:x265|hevc|10bit)\b/i.test(title)) score += 15;
  if (/\b(?:pc|windows)\b/i.test(title)) score += 15;

  // Heavy penalty for obscure codecs (AV1) or obscure personal rips (DKong, Soup) unless explicitly requested
  if (/\bav1\b/i.test(title) && !query.includes('av1')) {
    score -= 150;
  }
  if (/\b(?:dkong|soup|speranzah)\b/i.test(title)) {
    score -= 100;
  }

  // 6. Size constraint weighting
  if (maxSizeBytes && maxSizeBytes > 0) {
    if (rawSize <= maxSizeBytes) {
      score += 40;
    } else {
      const ratio = rawSize / maxSizeBytes;
      if (ratio <= 1.20) {
        score += 15;
      } else {
        score -= (ratio - 1) * 60;
      }
    }
  }

  // Penalize cams, ts, samples, trailers
  if (/\b(?:cam|hdcam|ts|hdts|telesync|sample|trailer)\b/i.test(title)) {
    score -= 300;
  }

  return score;
}

/**
 * Execute the autonomous AI Agent pipeline for a user prompt
 */
export async function runAgent(
  userInput: string,
  options?: {
    apiKeyOverride?: string;
    mirrorOverride?: string;
    autoResolveTopMagnet?: boolean;
  }
): Promise<AgentRunResult> {
  const thoughts: string[] = [];
  const autoResolve = options?.autoResolveTopMagnet !== false;

  thoughts.push(`Analyzing user request: "${userInput}"`);

  // Step 1: AI Intent & Query Analysis
  const analysis = await analyzeQueryWithGemini(userInput, options?.apiKeyOverride);
  thoughts.push(
    `Intent: ${analysis.intent} | Target: "${analysis.coreTitle}" (Category: ${analysis.category}${
      analysis.qualityPreference !== 'any' ? `, Quality: ${analysis.qualityPreference}` : ''
    }${analysis.maxSizeBytes ? `, MaxSize: ${(analysis.maxSizeBytes / (1024 * 1024 * 1024)).toFixed(1)}GB` : ''}${
      analysis.seasonEpisode?.tag ? `, Tag: ${analysis.seasonEpisode.tag}` : ''
    }${analysis.requiresSubtitles ? ', Subtitles: Yes' : ''})`
  );

  // Step 2: Parallel Multi-Tier Search on ext.to & swarms
  const searchQueries = analysis.searchQueries && analysis.searchQueries.length > 0
    ? analysis.searchQueries
    : [analysis.cleanQuery, analysis.coreTitle];

  const uniqueQueries = Array.from(new Set(searchQueries.filter(q => q && q.length > 1)));

  let rawItems: TorrentItem[] = [];
  let mirrorUsed = options?.mirrorOverride || 'https://extto.com';
  let successfulQuery = analysis.cleanQuery;

  for (const q of uniqueQueries) {
    thoughts.push(`Searching indexers for "${q}"...`);
    const searchRes = await searchExtTorrents(q, {
      category: analysis.category !== 'All' ? analysis.category : undefined,
      mirror: options?.mirrorOverride,
    });

    if (searchRes.success && searchRes.items.length > 0) {
      rawItems = searchRes.items;
      mirrorUsed = searchRes.mirrorUsed;
      successfulQuery = q;
      thoughts.push(`Found ${rawItems.length} releases for "${q}"`);
      break;
    }
  }

  if (rawItems.length === 0 && analysis.coreTitle) {
    thoughts.push(`Searching broad canonical title "${analysis.coreTitle}"...`);
    const fallbackRes = await searchExtTorrents(analysis.coreTitle, { mirror: options?.mirrorOverride });
    if (fallbackRes.success && fallbackRes.items.length > 0) {
      rawItems = fallbackRes.items;
      mirrorUsed = fallbackRes.mirrorUsed;
      successfulQuery = analysis.coreTitle;
      thoughts.push(`Broad title search found ${rawItems.length} releases`);
    }
  }

  // Step 3: Strict Title & Franchise Relevance Filtering
  let titleFilteredItems = rawItems.filter(it =>
    isStrictTitleMatch(it.title, analysis.canonicalTitle || analysis.coreTitle, analysis.alternateTitles)
  );

  // If user searched for a TV show/season, strictly require TV markers and eliminate standalone movies
  if (analysis.intent === 'tv_season_pack' || analysis.intent === 'tv_single_episode' || analysis.category === 'TV') {
    const tvFiltered = titleFilteredItems.filter(it => {
      if (isMovieRelease(it.title)) return false;
      const lower = it.title.toLowerCase();
      const hasTvMarker = /\b(?:s\d{1,2}e\d{1,2}|season\s*\d+|s\d{1,2}\b|episode\s*\d+|ep\s*\d+|complete\s+series|all\s+seasons|the\s+complete\s+seasons|complete\s+season|seasons\s*\d+|tv\s+series|batch)\b/i.test(lower);
      return hasTvMarker;
    });

    if (tvFiltered.length > 0) {
      titleFilteredItems = tvFiltered;
    } else {
      titleFilteredItems = [];
    }
  }

  if (titleFilteredItems.length > 0) {
    thoughts.push(`Filtered to ${titleFilteredItems.length} verified releases for "${analysis.coreTitle}"`);
  }

  let filteredItems = [...titleFilteredItems];
  let filterNote = '';

  // 3a. Filter by Season Pack or Single Episode
  if (analysis.seasonEpisode) {
    if (analysis.seasonEpisode.isSeasonPack) {
      const season = analysis.seasonEpisode.season;
      const sNum = season?.toString() || '';
      const sPadded = season?.toString().padStart(2, '0') || '';

      const matchingSeason = filteredItems.filter(it => {
        const titleLower = it.title.toLowerCase();
        if (season) {
          return (
            titleLower.includes(`season ${sNum}`) ||
            titleLower.includes(`season ${sPadded}`) ||
            titleLower.includes(`season: ${sNum}`) ||
            titleLower.includes(`seasons: ${sNum}`) ||
            titleLower.includes(`season 0${sNum}`) ||
            titleLower.includes(`s${sPadded}`) ||
            titleLower.includes(`s${sNum}`) ||
            titleLower.includes(`season 1-${sNum}`) ||
            titleLower.includes(`seasons 1-${sNum}`) ||
            titleLower.includes(`seasons: 1-`) ||
            titleLower.includes(`s01-s${sPadded}`) ||
            titleLower.includes(`s01-`) ||
            titleLower.includes(`complete series`) ||
            titleLower.includes(`the complete seasons`) ||
            titleLower.includes(`all seasons`) ||
            titleLower.includes(`complete season`)
          );
        }
        return (
          titleLower.includes('complete series') ||
          titleLower.includes('the complete seasons') ||
          titleLower.includes('all seasons') ||
          titleLower.includes('complete') ||
          titleLower.includes('season 1-') ||
          titleLower.includes('s01-')
        );
      });

      if (matchingSeason.length > 0) {
        filteredItems = matchingSeason;
        thoughts.push(`Filtered to ${matchingSeason.length} releases for ${analysis.seasonEpisode.tag || 'Season Pack'}`);
      } else {
        filterNote = `Note: Season pack for "${analysis.coreTitle} ${analysis.seasonEpisode.tag}" is not available separately. Showing all matching releases.`;
        thoughts.push(filterNote);
      }
    } else if (analysis.seasonEpisode.episode !== undefined) {
      const { season, episode, tag } = analysis.seasonEpisode;
      const epNum = episode.toString();
      const epPadded = episode.toString().padStart(2, '0');
      const sNum = season?.toString() || '1';
      const sPadded = (season || 1).toString().padStart(2, '0');

      const matchingEpisode = filteredItems.filter(it => {
        const titleLower = it.title.toLowerCase();
        return (
          (tag && titleLower.includes(tag.toLowerCase())) ||
          titleLower.includes(`s${sPadded}e${epPadded}`) ||
          titleLower.includes(`s${sNum}e${epPadded}`) ||
          titleLower.includes(`e${epPadded}`) ||
          (titleLower.includes(`season: ${sNum}`) && titleLower.includes(`episode`)) ||
          titleLower.includes(`episode ${epNum}`) ||
          titleLower.includes(`ep ${epNum}`) ||
          titleLower.includes(`ep.${epNum}`)
        );
      });

      if (matchingEpisode.length > 0) {
        filteredItems = matchingEpisode;
        thoughts.push(`Filtered to ${matchingEpisode.length} releases specifically for S${sPadded}E${epPadded}`);
      } else {
        filterNote = `Note: Episode ${episode} is not yet indexed separately. Showing available releases of "${analysis.coreTitle}".`;
        thoughts.push(filterNote);
      }
    }
  }

  // 3b. Filter / Rank by Quality Preference if requested
  if (analysis.qualityPreference !== 'any') {
    const pref = analysis.qualityPreference.toLowerCase();
    const matchingQuality = filteredItems.filter(it => it.title.toLowerCase().includes(pref));
    if (matchingQuality.length > 0) {
      filteredItems = matchingQuality;
      thoughts.push(`Filtered to ${matchingQuality.length} releases in "${analysis.qualityPreference}"`);
    }
  }

  // 3c. Boost Subtitles if requested
  if (analysis.requiresSubtitles) {
    const withSubs = filteredItems.filter(it => {
      const lower = it.title.toLowerCase();
      return lower.includes('sub') || lower.includes('esub') || lower.includes('subtitle') || lower.includes('multi');
    });
    if (withSubs.length > 0) {
      const withoutSubs = filteredItems.filter(it => !withSubs.includes(it));
      filteredItems = [...withSubs, ...withoutSubs];
      thoughts.push(`Prioritized ${withSubs.length} releases with confirmed subtitles`);
    }
  }

  // 3d. Sort releases with smart scoring
  filteredItems.sort((a, b) => {
    return (
      scoreRelease(b, userInput, analysis.maxSizeBytes, analysis.intent) -
      scoreRelease(a, userInput, analysis.maxSizeBytes, analysis.intent)
    );
  });

  let topPick = filteredItems.length > 0 ? filteredItems[0] : (titleFilteredItems.length > 0 ? titleFilteredItems[0] : undefined);
  const itemsToReturn = filteredItems.length > 0 ? filteredItems : titleFilteredItems;

  if (topPick) {
    thoughts.push(`Selected top pick: "${topPick.title}" (${topPick.size}, ${topPick.seeders} seeds)`);

    // Step 4: Auto-resolve magnet link for top pick
    if (autoResolve && topPick.id) {
      thoughts.push(`Resolving verified magnet link for "${topPick.title}"...`);
      const magnetRes = await resolveMagnetLink(topPick.id, topPick.detailUrl, mirrorUsed);
      if (magnetRes.success && magnetRes.magnetUrl) {
        topPick.magnetUrl = magnetRes.magnetUrl;
        topPick.infoHash = magnetRes.infoHash;
        thoughts.push(`Successfully verified magnet URI (${magnetRes.infoHash || 'OK'})`);
      } else {
        thoughts.push(`Magnet resolution note: ${magnetRes.error || 'Direct link ready'}`);
      }
    }
  }

  // Step 5: Synthesize AI Response
  thoughts.push(`Generating final response...`);
  const summary = await synthesizeAgentResponse(
    userInput,
    analysis,
    itemsToReturn,
    options?.apiKeyOverride,
    filterNote
  );

  return {
    query: userInput,
    refinedQuery: successfulQuery,
    coreTitle: analysis.coreTitle,
    category: analysis.category,
    intent: analysis.intent,
    items: itemsToReturn,
    topPick,
    summary,
    thoughts,
    mirrorUsed
  };
}
