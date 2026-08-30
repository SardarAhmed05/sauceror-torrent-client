import { searchExtTorrents, resolveMagnetLink } from '../scraper/ext';
import { TorrentItem } from '../scraper/types';
import { analyzeQueryWithGemini, synthesizeAgentResponse } from './gemini';

export interface AgentRunResult {
  query: string;
  refinedQuery: string;
  coreTitle: string;
  category: string;
  items: TorrentItem[];
  topPick?: TorrentItem;
  summary: string;
  thoughts: string[];
  mirrorUsed: string;
}

/**
 * Strict check to ensure the torrent is for the actual requested title
 */
export function isStrictTitleMatch(itemTitle: string, targetTitle: string): boolean {
  if (!targetTitle || targetTitle.trim().length === 0) return true;

  const cleanItem = itemTitle.toLowerCase().replace(/['":]/g, '').replace(/[._-]/g, ' ').trim();
  const cleanTarget = targetTitle.toLowerCase().replace(/['":]/g, '').replace(/[._-]/g, ' ').trim();

  if (cleanItem.startsWith(cleanTarget)) {
    const nextChar = cleanItem[cleanTarget.length];
    if (!nextChar || /\s|\d|\(|\[/.test(nextChar)) {
      return true;
    }
  }

  const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 1);
  if (targetWords.length === 0) return true;

  const qualitySplit = cleanItem.split(/\b(?:1080p|720p|2160p|4k|uhd|bluray|brrip|web-?dl|hdrip|dvdrip|x264|x265|hevc|remux|h264|h265)\b/i);
  const mainTitlePart = qualitySplit[0].trim();
  const mainWords = mainTitlePart.split(/\s+/);

  if (targetWords.length === 1) {
    if (mainWords[0] === targetWords[0] || (mainWords.length > 1 && mainWords[1] === targetWords[0] && ['the', 'a', 'an'].includes(mainWords[0]))) {
      return true;
    }
    return false;
  }

  const targetPhrase = targetWords.join(' ');
  if (mainTitlePart.startsWith(targetPhrase) || mainTitlePart.includes(targetPhrase)) {
    const idx = mainTitlePart.indexOf(targetPhrase);
    const prefix = mainTitlePart.substring(0, idx).trim();
    if (!prefix || ['the', 'a', 'an'].includes(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Score a release based on swarm health, source reputation, format compatibility, and size
 */
export function scoreRelease(
  item: TorrentItem,
  userQuery: string,
  maxSizeBytes?: number
): number {
  let score = 0;
  const title = (item.title || '').toLowerCase();
  const query = userQuery.toLowerCase();
  const rawSize = item.sizeBytes || 0;
  const seeds = item.seeders || 0;

  // 1. Seed health (logarithmic scale)
  score += Math.log10(Math.max(1, seeds)) * 30;

  // 2. High reputation gold-standard release groups
  if (/\b(?:yify|yts)\b/i.test(title)) score += 60;
  else if (/\b(?:galaxyrg|rarbg|psa|ethel|flux|killers|qxr|tigole)\b/i.test(title)) score += 50;

  // 3. Quality source format (BluRay / WEB-DL / HDTV)
  if (/\b(?:bluray|brrip|bdrip|remux)\b/i.test(title)) score += 30;
  else if (/\b(?:web-?dl|webrip|amzn|hmax|dsnp|nf)\b/i.test(title)) score += 25;
  else if (/\bhdtv\b/i.test(title)) score += 15;

  // 4. Universal Codec compatibility (x264 is #1 compatible on all players/TVs)
  if (/\b(?:x264|h264|avc)\b/i.test(title)) score += 25;
  else if (/\b(?:x265|hevc|10bit)\b/i.test(title)) score += 15;

  // Heavy penalty for obscure codecs (AV1) or obscure personal rips (DKong, Soup) unless explicitly requested
  if (/\bav1\b/i.test(title) && !query.includes('av1')) {
    score -= 150;
  }
  if (/\b(?:dkong|soup|speranzah)\b/i.test(title)) {
    score -= 100;
  }

  // 5. Size constraint weighting
  if (maxSizeBytes && maxSizeBytes > 0) {
    if (rawSize <= maxSizeBytes) {
      score += 40; // Bonus for strictly within size limit
    } else {
      // Allow slight tolerance (up to 20% over limit) for gold-standard releases like YIFY (2.26GB vs 2.0GB)
      const ratio = rawSize / maxSizeBytes;
      if (ratio <= 1.20) {
        score += 15; // Small penalty for close match
      } else {
        score -= (ratio - 1) * 60; // Strong penalty for oversized files
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
    `Target: "${analysis.coreTitle}" (Query: "${analysis.cleanQuery}", Quality: ${analysis.qualityPreference}${
      analysis.maxSizeBytes ? `, MaxSize: ${(analysis.maxSizeBytes / (1024 * 1024 * 1024)).toFixed(1)}GB` : ''
    }${analysis.seasonEpisode?.tag ? `, Episode: ${analysis.seasonEpisode.tag}` : ''}${
      analysis.requiresSubtitles ? ', Subtitles: Yes' : ''
    })`
  );

  // Step 2: Multi-Tier Search on ext.to & swarms
  const candidateQueries: string[] = [];

  if (analysis.seasonEpisode?.tag) {
    const baseTitle = analysis.coreTitle;
    if (analysis.qualityPreference !== 'any') {
      candidateQueries.push(`${baseTitle} ${analysis.seasonEpisode.tag} ${analysis.qualityPreference}`);
    }
    candidateQueries.push(`${baseTitle} ${analysis.seasonEpisode.tag}`);
    candidateQueries.push(`${baseTitle} Season ${analysis.seasonEpisode.season} Episode ${analysis.seasonEpisode.episode}`);
    candidateQueries.push(`${baseTitle} E${analysis.seasonEpisode.episode?.toString().padStart(2, '0')}`);
    candidateQueries.push(`${baseTitle} S${analysis.seasonEpisode.season?.toString().padStart(2, '0')}`);
    candidateQueries.push(baseTitle);
  } else {
    candidateQueries.push(analysis.cleanQuery);
    if (analysis.qualityPreference !== 'any') {
      candidateQueries.push(`${analysis.coreTitle} ${analysis.qualityPreference}`);
    }
    candidateQueries.push(analysis.coreTitle);
  }

  const uniqueCandidateQueries = Array.from(new Set(candidateQueries.filter(q => q.length > 1)));

  let rawItems: TorrentItem[] = [];
  let mirrorUsed = options?.mirrorOverride || 'https://extto.com';
  let successfulQuery = analysis.cleanQuery;

  for (const q of uniqueCandidateQueries) {
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
    thoughts.push(`Searching broad title "${analysis.coreTitle}"...`);
    const fallbackRes = await searchExtTorrents(analysis.coreTitle, { mirror: options?.mirrorOverride });
    if (fallbackRes.success && fallbackRes.items.length > 0) {
      rawItems = fallbackRes.items;
      mirrorUsed = fallbackRes.mirrorUsed;
      successfulQuery = analysis.coreTitle;
      thoughts.push(`Broad title search found ${rawItems.length} releases`);
    }
  }

  // Step 3: Strict Title Relevance Filtering
  let titleFilteredItems = rawItems.filter(it => isStrictTitleMatch(it.title, analysis.coreTitle));
  if (titleFilteredItems.length > 0) {
    thoughts.push(`Filtered to ${titleFilteredItems.length} verified releases for "${analysis.coreTitle}"`);
  } else {
    titleFilteredItems = rawItems;
  }

  let filteredItems = [...titleFilteredItems];
  let filterNote = '';

  // 3a. Filter by Season & Episode if requested
  if (analysis.seasonEpisode) {
    const { season, episode, tag } = analysis.seasonEpisode;
    const epNum = episode?.toString() || '';
    const epPadded = episode?.toString().padStart(2, '0') || '';
    const sNum = season?.toString() || '';
    const sPadded = season?.toString().padStart(2, '0') || '';

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

  // 3d. Sort releases with smart scoring (Swarm Health + Group Reputation + Format Compatibility + Size)
  filteredItems.sort((a, b) => {
    return scoreRelease(b, userInput, analysis.maxSizeBytes) - scoreRelease(a, userInput, analysis.maxSizeBytes);
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
    items: itemsToReturn,
    topPick,
    summary,
    thoughts,
    mirrorUsed
  };
}
