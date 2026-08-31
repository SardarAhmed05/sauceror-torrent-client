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

  // Extract infoHash for 1-click clickable link
  let infoHash = best.infoHash || '';
  if (!infoHash && best.magnetUrl) {
    const hashMatch = best.magnetUrl.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    if (hashMatch) infoHash = hashMatch[1];
  }

  // Create a clean, compact magnet without messy URL-encoded tracker clutter
  let cleanMagnet = best.magnetUrl || '';
  if (cleanMagnet.includes('&tr=')) {
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

  if (infoHash) {
    const shortTitle = encodeURIComponent(best.title.slice(0, 50));
    msg += `⚡ *1-CLICK INSTANT DOWNLOAD:*\n`;
    msg += `👉 https://sauceror.vercel.app/m/${infoHash}?dn=${shortTitle}\n`;
    msg += `_(Tap link to launch directly in your torrent app)_\n\n`;
  }

  if (cleanMagnet) {
    msg += `🧲 *OR TAP & HOLD TO COPY MAGNET:*\n\`\`\`\n${cleanMagnet}\n\`\`\`\n\n`;
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
