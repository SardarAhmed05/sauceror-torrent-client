import { TorrentItem } from '../scraper/types';

/**
 * Format a torrent item and search summary for WhatsApp text output
 */
export function formatWhatsAppMessage(
  query: string,
  items: TorrentItem[],
  topPick?: TorrentItem
): string {
  if (!items || items.length === 0) {
    return (
      `🔍 *Sauceror AI Agent*\n\n` +
      `No torrent results found for: "${query}"\n\n` +
      `💡 *Tips:*\n` +
      `• Try adding the release year (e.g. "Dune Part Two ( 2024 )").\n` +
      `• Specify a season or episode (e.g. "Game of Thrones Season 1").\n` +
      `• Check spelling or try simpler keywords.`
    );
  }

  const best = topPick || items[0];

  // Create a clean, compact magnet without messy URL-encoded tracker clutter
  let cleanMagnet = best.magnetUrl || '';
  if (cleanMagnet.includes('&tr=')) {
    // Keep xt and dn for ultra clean 1-tap copy
    const parts = cleanMagnet.split('&tr=');
    cleanMagnet = parts[0];
  }

  let msg = `⚡ *SAUCEROR AI AGENT* ⚡\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔎 *Query:* "${query}"\n`;
  msg += `📊 *Releases Found:* ${items.length} verified releases\n\n`;

  msg += `🎯 *TOP RECOMMENDATION*\n`;
  msg += `📁 *Title:* ${best.title}\n`;
  msg += `📦 *Size:* ${best.size}  |  🌱 *Seeds:* ${best.seeders}\n`;
  msg += `🏷️ *Category:* ${best.category}${best.subcategory ? ` / ${best.subcategory}` : ''}\n`;
  if (best.sourceTracker) {
    msg += `🌐 *Source:* ${best.sourceTracker}\n`;
  }
  msg += `\n`;

  if (cleanMagnet) {
    msg += `🧲 *TAP & HOLD TO COPY MAGNET:*\n\`\`\`\n${cleanMagnet}\n\`\`\`\n\n`;
    msg += `👉 _Paste into Flud, uTorrent, LibreTorrent, or qBittorrent to start downloading._\n\n`;
  } else if (best.detailUrl) {
    msg += `🔗 *Detail Link:*\n${best.detailUrl}\n\n`;
  }

  msg += `🌐 *View & Search on Web:*\nhttps://sauceror.vercel.app\n\n`;

  const otherReleases = items.filter((it) => it.id !== best.id);
  if (otherReleases.length > 0) {
    msg += `📋 *OTHER VERSIONS AVAILABLE:*\n`;
    otherReleases.slice(0, 4).forEach((item, idx) => {
      msg += `${idx + 2}. *${item.title}*\n`;
      msg += `   ↳ 📦 ${item.size}  •  🌱 ${item.seeders} seeds\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🤖 _Sauceror AI • Built by Sardar Ahmed_`;

  return msg;
}

/**
 * Format simple WhatsApp help text
 */
export function formatWhatsAppHelp(): string {
  return (
    `👋 *Welcome to Sauceror AI Agent on WhatsApp!*\n\n` +
    `I can search verified torrent indexers and deliver instant magnet download links to your chat.\n\n` +
    `💡 *How to use:*\n` +
    `• Movies: \`Interstellar 1080p under 2 gbs\` or \`Dune Part Two ( 2024 ) 4k\`\n` +
    `• Series: \`Game of Thrones Season 1\` or \`House S01E01\`\n` +
    `• Dubbed / Audio: \`Breaking Bad Hindi\` or \`Game of thrones Dual Audio\`\n` +
    `• Software / Anime: \`Ubuntu 24.04 desktop iso\` or \`Attack on Titan 1080p\`\n\n` +
    `Just send any movie, show, or game title, and I'll deliver verified magnets instantly!`
  );
}
