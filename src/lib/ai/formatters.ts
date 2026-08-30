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
      `No torrent results found on *ext.to* for: "${query}"\n\n` +
      `💡 *Tips:*\n` +
      `• Check spelling of the title/release.\n` +
      `• Try removing special characters or version numbers.\n` +
      `• Try broader terms (e.g. "Interstellar" instead of exact full release string).`
    );
  }

  const best = topPick || items[0];

  let msg = `⚡ *SAUCEROR AI AGENT* ⚡\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔎 *Query:* "${query}"\n`;
  msg += `📊 *Releases Found:* ${items.length} verified releases\n\n`;

  msg += `🎯 *TOP RECOMMENDATION*\n`;
  msg += `📁 *Title:* ${best.title}\n`;
  msg += `📦 *Size:* ${best.size}\n`;
  msg += `🌱 *Seeders:* ${best.seeders} | 🔻 *Leechers:* ${best.leechers}\n`;
  msg += `🏷️ *Category:* ${best.category}${best.subcategory ? ` / ${best.subcategory}` : ''}\n`;
  msg += `🕒 *Uploaded:* ${best.age}\n`;
  if (best.sourceTracker) {
    msg += `🌐 *Source:* ${best.sourceTracker}\n`;
  }
  msg += `\n`;

  if (best.magnetUrl) {
    msg += `🧲 *MAGNET LINK:*\n\`\`\`\n${best.magnetUrl}\n\`\`\`\n\n`;
    msg += `👉 _Tap and hold to copy magnet link, or open in torrent client._\n\n`;
  } else {
    msg += `🔗 *Detail Link:*\n${best.detailUrl}\n\n`;
  }

  const otherReleases = items.filter((it) => it.id !== best.id);
  if (otherReleases.length > 0) {
    msg += `📋 *OTHER MATCHING RELEASES FOR THIS TITLE:*\n`;
    otherReleases.slice(0, 5).forEach((item, idx) => {
      msg += `${idx + 2}. *${item.title}*\n`;
      msg += `   ↳ 📦 ${item.size} | 🌱 ${item.seeders} seeds | 🌐 ${item.sourceTracker || 'ext'}\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🤖 _Sauceror AI • Built by Sardar Ahmed_\n`;
  msg += `🌐 _github.com/SardarAhmed05/sauceror-torrent-client_`;

  return msg;
}

/**
 * Format simple WhatsApp help text
 */
export function formatWhatsAppHelp(): string {
  return (
    `👋 *Welcome to Sauceror AI Agent on WhatsApp!*\n\n` +
    `I can search *ext.to* and give you verified magnet download links instantly.\n\n` +
    `💡 *How to use:*\n` +
    `• Send any movie name: \`Interstellar 1080p under 2 gbs\`\n` +
    `• Send series: \`Lanterns S01E02 1080p\`\n` +
    `• Send software/OS: \`Ubuntu 24.04 desktop iso\`\n` +
    `• Send books: \`Python cookbook pdf\`\n` +
    `• Send games: \`Cyberpunk 2077 pc\`\n\n` +
    `Just send your search query and I will deliver verified magnet links for you!`
  );
}
