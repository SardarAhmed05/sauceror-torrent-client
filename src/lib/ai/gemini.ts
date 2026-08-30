import { GoogleGenerativeAI } from '@google/generative-ai';
import { EXT_QUERY_REFINER_PROMPT } from './prompts';
import { parseSizeBytes } from '../scraper/ext';

export type QueryIntent =
  | 'tv_season_pack'
  | 'tv_single_episode'
  | 'movie'
  | 'game'
  | 'software'
  | 'music'
  | 'book'
  | 'anime'
  | 'other';

export interface QueryAnalysis {
  cleanQuery: string;
  coreTitle: string;
  canonicalTitle?: string;
  alternateTitles?: string[];
  category: string;
  intent: QueryIntent;
  qualityPreference: string;
  maxSizeBytes?: number;
  minSizeBytes?: number;
  requiresSubtitles?: boolean;
  requiresDualAudio?: boolean;
  seasonEpisode?: {
    season?: number;
    episode?: number;
    tag?: string;
    isSeasonPack?: boolean;
    isCompleteSeries?: boolean;
  };
  searchQueries?: string[];
  explanation: string;
}

/**
 * Extract size constraints from natural language (e.g. "under 2 gbs", "less than 1.5 GB", "max 700MB")
 */
export function extractSizeConstraints(text: string): {
  cleanedText: string;
  maxSizeBytes?: number;
  minSizeBytes?: number;
} {
  let cleaned = text;
  let maxSizeBytes: number | undefined;
  let minSizeBytes: number | undefined;

  const unitRegex = '(?:gb|gbs|gigabytes?|gigs?|mb|mbs|megabytes?|megs?|tb|tbs|terabytes?|kb|kbs|kilobytes?|g|m|k)';

  // Pattern: under / less than / below / at most / max / smaller than X GB/MB
  const maxPattern = new RegExp(`\\b(?:under|less\\s+than|below|at\\s+most|max|maximum|smaller\\s+than|thats\\s+under|that\\s+is\\s+under|<)\\s*([\\d.]+\\s*${unitRegex})\\b`, 'i');
  const maxMatch = cleaned.match(maxPattern);
  if (maxMatch) {
    maxSizeBytes = parseSizeBytes(maxMatch[1]);
    cleaned = cleaned.replace(maxMatch[0], ' ');
  }

  // Pattern: over / more than / above / at least / min / greater than X GB/MB
  const minPattern = new RegExp(`\\b(?:over|more\\s+than|above|at\\s+least|min|minimum|larger\\s+than|>)\\s*([\\d.]+\\s*${unitRegex})\\b`, 'i');
  const minMatch = cleaned.match(minPattern);
  if (minMatch) {
    minSizeBytes = parseSizeBytes(minMatch[1]);
    cleaned = cleaned.replace(minMatch[0], ' ');
  }

  // Clean trailing filler words like "thats", "which is", "with size", "around"
  cleaned = cleaned.replace(/\b(?:thats|that\s+is|which\s+is|with\s+size|size|around)\b/gi, ' ');

  return {
    cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
    maxSizeBytes,
    minSizeBytes
  };
}

/**
 * Extract feature qualifiers like "with subtitles", "dual audio", "english subs"
 */
export function extractFeatureQualifiers(text: string): {
  cleanedText: string;
  requiresSubtitles?: boolean;
  requiresDualAudio?: boolean;
} {
  let cleaned = text;
  let requiresSubtitles = false;
  let requiresDualAudio = false;

  // Subtitles patterns
  const subPattern = /\b(?:with\s+(?:english\s+)?(?:subtitles?|subs?|esubs?)|(?:english\s+)?subtitles?|english\s+subs?|with\s+sub|subbed|softsubs?|hardsubs?)\b/gi;
  if (subPattern.test(cleaned)) {
    requiresSubtitles = true;
    cleaned = cleaned.replace(subPattern, ' ');
  }

  // Dual audio patterns
  const audioPattern = /\b(?:with\s+dual\s+audio|dual\s+audio|multi\s+audio|multi\s+dub|hindi\s+dubbed|hindi\s+audio|french\s+audio|spanish\s+audio)\b/gi;
  if (audioPattern.test(cleaned)) {
    requiresDualAudio = true;
    cleaned = cleaned.replace(audioPattern, ' ');
  }

  // General filler qualifiers
  const fillerQualifiers = /\b(?:with\s+seeds?|with\s+good\s+seeds?|healthy\s+seeds?|active\s+seeds?|best\s+quality|high\s+quality|full\s+movie|full\s+episode|direct\s+download|fast\s+download)\b/gi;
  cleaned = cleaned.replace(fillerQualifiers, ' ');

  return {
    cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
    requiresSubtitles,
    requiresDualAudio
  };
}

/**
 * Extract Season and Episode information (e.g. "Season 3 Episode 3", "S03E03", "Season 1", "Season 8", "Complete Series")
 */
export function extractSeasonEpisode(text: string): {
  cleanedText: string;
  seasonEpisode?: {
    season?: number;
    episode?: number;
    tag?: string;
    isSeasonPack?: boolean;
    isCompleteSeries?: boolean;
  };
} {
  let cleaned = text;
  let season: number | undefined;
  let episode: number | undefined;
  let tag: string | undefined;
  let isSeasonPack = false;
  let isCompleteSeries = false;

  // 1. Complete Series pattern (e.g. "Breaking Bad Complete Series", "Game of Thrones All Seasons")
  if (/\b(?:complete\s+series|all\s+seasons|full\s+series|complete\s+show)\b/i.test(text)) {
    isSeasonPack = true;
    isCompleteSeries = true;
    tag = 'Complete Series';
    cleaned = cleaned.replace(/\b(?:complete\s+series|all\s+seasons|full\s+series|complete\s+show)\b/gi, ' ');
  }

  // 2. Pattern: S01E03 or S1E3
  const sxxExxMatch = text.match(/\bS(\d{1,2})E(\d{1,2})\b/i);
  if (sxxExxMatch) {
    season = parseInt(sxxExxMatch[1], 10);
    episode = parseInt(sxxExxMatch[2], 10);
    cleaned = cleaned.replace(sxxExxMatch[0], ' ');
  } else {
    // 3. Pattern: Season X Episode Y
    const fullMatch = text.match(/\bseason\s*(\d{1,2})\s*(?:episode|ep)\s*(\d{1,2})\b/i);
    if (fullMatch) {
      season = parseInt(fullMatch[1], 10);
      episode = parseInt(fullMatch[2], 10);
      cleaned = cleaned.replace(fullMatch[0], ' ');
    } else {
      // 4. Pattern: Episode X or Ep X
      const epOnlyMatch = text.match(/\b(?:episode|ep)\s*(\d{1,2})\b/i);
      if (epOnlyMatch) {
        season = 1;
        episode = parseInt(epOnlyMatch[1], 10);
        cleaned = cleaned.replace(epOnlyMatch[0], ' ');
      } else {
        // 5. Pattern: Season X or S0X (Complete Season Pack!)
        const seasonOnlyMatch = text.match(/\b(?:season\s*(\d{1,2})|s(\d{1,2}))\b/i);
        if (seasonOnlyMatch) {
          season = parseInt(seasonOnlyMatch[1] || seasonOnlyMatch[2], 10);
          isSeasonPack = true;
          tag = `Season ${season}`;
          cleaned = cleaned.replace(seasonOnlyMatch[0], ' ');
        }
      }
    }
  }

  if (episode !== undefined) {
    const sStr = (season || 1).toString().padStart(2, '0');
    const eStr = episode.toString().padStart(2, '0');
    tag = `S${sStr}E${eStr}`;
    isSeasonPack = false;
  } else if (season !== undefined) {
    tag = `Season ${season}`;
    isSeasonPack = true;
  }

  const hasResult = season !== undefined || episode !== undefined || isSeasonPack || isCompleteSeries;

  return {
    cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
    seasonEpisode: hasResult ? { season, episode, tag, isSeasonPack, isCompleteSeries } : undefined
  };
}

/**
 * Clean conversational prefixes from user query
 */
export function cleanConversationalPrefix(input: string): string {
  let text = input.trim();
  let prevText = '';

  const prefixPatterns = [
    /^(?:hey|hi|hello|agent|sauceror|bot)\b[,\s]*/i,
    /^(?:can\s+you\s+please|could\s+you\s+please|please\s+can\s+you|please\s+could\s+you|can\s+you|could\s+you|would\s+you|please)\b\s*/i,
    /^(?:i\s+need|i\s+want|i\s+am\s+looking\s+for|i'm\s+looking\s+for|looking\s+for|search\s+for|search\s+ext\s+for|search\s+ext|search|find\s+me|find|get\s+me|get|give\s+me|give|look\s+up|fetch\s+me|fetch|scrape\s+ext\s+for|scrape\s+ext|scrape|check\s+for)\b\s*/i,
    /^(?:a\s+torrent\s+link\s+for|the\s+torrent\s+link\s+for|torrent\s+link\s+for|a\s+magnet\s+link\s+for|the\s+magnet\s+link\s+for|magnet\s+link\s+for|a\s+download\s+link\s+for|the\s+download\s+link\s+for|download\s+link\s+for|a\s+link\s+for|the\s+link\s+for|link\s+for)\b\s*/i,
    /^(?:a\s+torrent\s+for|the\s+torrent\s+for|torrent\s+for|a\s+magnet\s+for|the\s+magnet\s+for|magnet\s+for|a\s+download\s+for|the\s+download\s+for|download\s+for)\b\s*/i,
    /^(?:a\s+torrent|the\s+torrent|torrent|a\s+magnet|the\s+magnet|magnet|a\s+download|the\s+download|download|ext\s+for|ext)\b\s*/i,
    /^(?:a|an|the|me|for|i)\b\s+/i
  ];

  while (prevText !== text) {
    prevText = text;
    for (const pattern of prefixPatterns) {
      text = text.replace(pattern, '').trim();
    }
  }

  return text.replace(/[?!.]+$/, '').trim();
}

/**
 * Extract core title by removing quality, resolution, format, and episode tags
 */
export function extractCoreTitle(text: string): string {
  let title = text
    .replace(/\b(?:1080p|720p|2160p|4k|uhd|bluray|brrip|web-?dl|hdrip|dvdrip|x264|x265|hevc|remux|imax|hdr|dv|h264|h265|flac|lossless|pdf|epub|iso|repack|patch|crack)\b/gi, ' ')
    .replace(/\b(?:s\d{1,2}e\d{1,2}|season\s*\d+\s*(?:episode|ep)\s*\d+|season\s*\d+|episode\s*\d+|ep\s*\d+|s\d{1,2})\b/gi, ' ')
    .replace(/\b(?:complete\s+series|all\s+seasons|complete\s+season|complete|batch)\b/gi, ' ')
    .replace(/\b(?:with\s+subtitles?|with\s+subs?|subtitles?|subs?|dual\s+audio)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title || text;
}

/**
 * Generate candidate search queries for indexers based on intent
 */
export function generateSearchQueries(
  coreTitle: string,
  intent: QueryIntent,
  seasonEpisode?: { season?: number; episode?: number; tag?: string; isSeasonPack?: boolean; isCompleteSeries?: boolean },
  qualityPreference?: string
): string[] {
  const queries: string[] = [];
  const base = coreTitle;

  if (intent === 'tv_season_pack') {
    const season = seasonEpisode?.season;
    if (season) {
      const sPadded = season.toString().padStart(2, '0');
      if (qualityPreference && qualityPreference !== 'any') {
        queries.push(`${base} Season ${season} ${qualityPreference}`);
        queries.push(`${base} S${sPadded} ${qualityPreference}`);
      }
      queries.push(`${base} Season ${season} Complete`);
      queries.push(`${base} S${sPadded} Complete`);
      queries.push(`${base} Season ${season}`);
      queries.push(`${base} S${sPadded}`);
      queries.push(`${base} Complete Series`);
      queries.push(`${base} Seasons`);
    } else {
      queries.push(`${base} Complete Series`);
      queries.push(`${base} Season 1 Complete`);
      queries.push(`${base} Season 1`);
      queries.push(`${base} All Seasons`);
      queries.push(`${base} Complete`);
      queries.push(base);
    }
  } else if (intent === 'tv_single_episode') {
    if (seasonEpisode?.tag) {
      if (qualityPreference && qualityPreference !== 'any') {
        queries.push(`${base} ${seasonEpisode.tag} ${qualityPreference}`);
      }
      queries.push(`${base} ${seasonEpisode.tag}`);
    }
    if (seasonEpisode?.season && seasonEpisode?.episode) {
      queries.push(`${base} Season ${seasonEpisode.season} Episode ${seasonEpisode.episode}`);
      queries.push(`${base} E${seasonEpisode.episode.toString().padStart(2, '0')}`);
      queries.push(`${base} S${seasonEpisode.season.toString().padStart(2, '0')}`);
    }
    queries.push(base);
  } else if (intent === 'game') {
    queries.push(base);
    queries.push(`${base} Repack`);
    queries.push(`${base} PC`);
    if (base.toLowerCase().includes('gta') || base.toLowerCase().includes('grand theft auto')) {
      queries.push('Grand Theft Auto V');
      queries.push('GTA V');
      queries.push('GTA 5');
    }
  } else if (intent === 'software') {
    queries.push(base);
    queries.push(`${base} ISO`);
    queries.push(`${base} x64`);
  } else {
    if (qualityPreference && qualityPreference !== 'any') {
      queries.push(`${base} ${qualityPreference}`);
    }
    queries.push(base);
  }

  return Array.from(new Set(queries.filter(q => q && q.length > 1)));
}

/**
 * Heuristic fallback for query refinement
 */
export function heuristicRefineQuery(input: string): QueryAnalysis {
  const { cleanedText: textAfterSizes, maxSizeBytes, minSizeBytes } = extractSizeConstraints(input);
  const { cleanedText: textAfterQualifiers, requiresSubtitles, requiresDualAudio } = extractFeatureQualifiers(textAfterSizes);
  const { seasonEpisode } = extractSeasonEpisode(textAfterQualifiers);
  let text = cleanConversationalPrefix(textAfterQualifiers);
  const coreTitle = extractCoreTitle(text);
  const lower = text.toLowerCase();

  let category = 'All';
  let intent: QueryIntent = 'movie';

  if (
    lower.includes('game of thrones') ||
    lower.includes('squid game') ||
    lower.includes('the wire') ||
    lower.includes('breaking bad') ||
    lower.includes('the sopranos') ||
    lower.includes('house of the dragon') ||
    lower.includes('house m.d.') ||
    lower.includes('stranger things') ||
    lower.includes('peaky blinders') ||
    seasonEpisode?.isSeasonPack ||
    seasonEpisode?.isCompleteSeries
  ) {
    category = 'TV';
    intent = 'tv_season_pack';
  } else if (seasonEpisode?.episode !== undefined) {
    category = 'TV';
    intent = 'tv_single_episode';
  } else if (/\b(s\d{1,2}e\d{1,2}|season\s*\d+|episode\s*\d+|series|tv show|seasons)\b/.test(lower)) {
    category = 'TV';
    intent = 'tv_season_pack';
  } else if (/\b(app|apk|software|windows|mac|linux|ubuntu|debian|keygen|setup|portable|iso|os|desktop|x64|amd64)\b/.test(lower)) {
    category = 'Apps';
    intent = 'software';
  } else if (/\b(pc game|fitgirl|dodi|crack|patch|mod|gta|steam|repack)\b/.test(lower) || (/\bgame\b/.test(lower) && !lower.includes('game of thrones') && !lower.includes('squid game'))) {
    category = 'Games';
    intent = 'game';
  } else if (/\b(flac|mp3|album|discography|ost|soundtrack|320kbps)\b/.test(lower)) {
    category = 'Music';
    intent = 'music';
  } else if (/\b(anime|manga|raw|subs?|crunchyroll|batch)\b/.test(lower)) {
    category = 'Anime';
    intent = 'anime';
  } else {
    category = 'Movies';
    intent = 'movie';
  }

  let qualityPreference = 'any';
  if (/\b(4k|2160p|uhd)\b/.test(lower)) qualityPreference = '4k';
  else if (/\b(1080p|fhd)\b/.test(lower)) qualityPreference = '1080p';
  else if (/\b(720p|hd)\b/.test(lower)) qualityPreference = '720p';
  else if (/\b(flac|lossless|wav)\b/.test(lower)) qualityPreference = 'lossless';
  else if (/\b(pdf|epub)\b/.test(lower)) qualityPreference = 'pdf';

  const searchQueries = generateSearchQueries(coreTitle || text || input, intent, seasonEpisode, qualityPreference);

  return {
    cleanQuery: text || input,
    coreTitle: coreTitle || text || input,
    canonicalTitle: coreTitle || text || input,
    category,
    intent,
    qualityPreference,
    maxSizeBytes,
    minSizeBytes,
    requiresSubtitles,
    requiresDualAudio,
    seasonEpisode,
    searchQueries,
    explanation: 'Heuristic keyword & intent extraction'
  };
}

/**
 * Use Gemini API (or heuristic fallback) to analyze and refine user intent
 */
export async function analyzeQueryWithGemini(
  userInput: string,
  apiKeyOverride?: string
): Promise<QueryAnalysis> {
  const heuristic = heuristicRefineQuery(userInput);
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return heuristic;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const prompt = `${EXT_QUERY_REFINER_PROMPT}\n\nUser request: "${userInput}"`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    const canonicalTitle = parsed.canonicalTitle || heuristic.canonicalTitle || heuristic.coreTitle;
    const alternateTitles = Array.isArray(parsed.alternateTitles) ? parsed.alternateTitles : [];
    const intent: QueryIntent = parsed.intent || heuristic.intent;
    const category = parsed.category || heuristic.category;
    const qualityPreference = parsed.qualityPreference || heuristic.qualityPreference;

    // Merge search queries
    const searchQueries = Array.isArray(parsed.searchQueries) && parsed.searchQueries.length > 0
      ? parsed.searchQueries
      : generateSearchQueries(canonicalTitle, intent, heuristic.seasonEpisode, qualityPreference);

    return {
      cleanQuery: parsed.cleanQuery || heuristic.cleanQuery,
      coreTitle: canonicalTitle,
      canonicalTitle,
      alternateTitles,
      category,
      intent,
      qualityPreference,
      maxSizeBytes: heuristic.maxSizeBytes,
      minSizeBytes: heuristic.minSizeBytes,
      requiresSubtitles: heuristic.requiresSubtitles,
      requiresDualAudio: heuristic.requiresDualAudio,
      seasonEpisode: heuristic.seasonEpisode,
      searchQueries,
      explanation: parsed.explanation || 'Analyzed with Gemini AI'
    };
  } catch (err: any) {
    console.warn('Gemini query analysis failed, falling back to heuristic:', err?.message);
    return heuristic;
  }
}

/**
 * Synthesize AI natural language answer about the search results
 */
export async function synthesizeAgentResponse(
  userQuery: string,
  analysis: QueryAnalysis,
  topItems: any[],
  apiKeyOverride?: string,
  filterNote?: string
): Promise<string> {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

  if (!apiKey || topItems.length === 0) {
    if (topItems.length === 0) {
      let msg = `I searched ext.to and swarm indexers for **"${analysis.coreTitle || analysis.cleanQuery}"** but couldn't find any active releases.`;
      if (analysis.maxSizeBytes) {
        msg += ` (Note: Size constraint was under ${(analysis.maxSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB).`;
      }
      return msg;
    }
    const best = topItems[0];
    let res = `Found **${topItems.length}** verified release${topItems.length === 1 ? '' : 's'} for **"${analysis.coreTitle || analysis.cleanQuery}"** on ext.to.\n\n`;
    if (filterNote) {
      res += `ℹ️ ${filterNote}\n\n`;
    }
    res += `🎯 **Top Pick:** **${best.title}**\n` +
      `📦 **Size:** ${best.size} | 🌱 **Seeds:** ${best.seeders} | 🔻 **Leechers:** ${best.leechers}\n` +
      `🕒 **Uploaded:** ${best.age} | 🏷️ **Category:** ${best.category}\n\n` +
      `Below is the list of matching releases for this title with 1-click magnet links.`;
    return res;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const itemsSummary = topItems.slice(0, 5).map((it, idx) =>
      `#${idx + 1}: ${it.title} (Size: ${it.size}, Seeds: ${it.seeders}, Leechs: ${it.leechers}, Age: ${it.age}, Source: ${it.sourceTracker || 'ext'})`
    ).join('\n');

    const prompt = `
You are Sauceror, an AI torrent assistant for ext.to.
User Query: "${userQuery}"
Content Title: "${analysis.coreTitle}"
Matching Releases on ext.to & verified swarms:
${itemsSummary}
${filterNote ? `Constraint Note: ${filterNote}` : ''}

Write a helpful, friendly, and concise response (max 2-3 sentences):
1. Confirm that you have found matching releases for "${analysis.coreTitle}".
2. Highlight the top recommendation and confirm how it matches the user's requirements (e.g. quality, size, seed health, subtitles).
`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err: any) {
    return `Found **${topItems.length}** verified releases for **"${analysis.coreTitle}"**. Top pick: **${topItems[0]?.title}** (${topItems[0]?.size}, ${topItems[0]?.seeders} seeds).`;
  }
}
