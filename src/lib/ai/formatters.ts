import { TorrentItem } from '../scraper/types';

function getItemHash(item: TorrentItem): string {
  if (item.infoHash) return item.infoHash;
  if (item.magnetUrl) {
    const hashMatch = item.magnetUrl.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    if (hashMatch) return hashMatch[1];
  }
  return '';
}

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
      `*Sauceror - Your torrent client*\n\n` +
      `No torrent results found for: "${query}"\n\n` +
      `💡 *Tips:*\n` +
      `• Try adding the release year (e.g. "Dune Part Two ( 2024 )").\n` +
      `• Specify a season or episode (e.g. "Game of Thrones Season 1").\n` +
      `• Check spelling or try simpler keywords.`
    );
  }

  const best = topPick || items[0];
  const bestHash = getItemHash(best);

  let msg = `*Sauceror - Your torrent client*\n\n`;
  msg += `🔎 *Query:* "${query}"\n`;
  msg += `📊 *Releases Found:* ${items.length} verified releases\n\n`;

  msg += `🎯 *TOP RECOMMENDATION*\n`;
  msg += `📁 *Title:* ${best.title}\n`;
  msg += `📦 *Size:* ${best.size}  |  🌱 *Seeds:* ${best.seeders}\n`;
  msg += `🏷️ *Category:* ${best.category}${best.subcategory ? ` / ${best.subcategory}` : ''}\n`;
  if (best.sourceTracker) {
    msg += `🌐 *Source:* ${best.sourceTracker}\n`;
  }
  if (bestHash) {
    const shortTitle = encodeURIComponent(best.title.slice(0, 50));
    msg += `👉 *Direct Download Link:*\nhttps://sauceror.vercel.app/m/${bestHash}?dn=${shortTitle}\n\n`;
  } else if (best.detailUrl) {
    msg += `🔗 *Detail Link:*\n${best.detailUrl}\n\n`;
  }

  const otherReleases = items.filter((it) => it.id !== best.id);
  if (otherReleases.length > 0) {
    msg += `📋 *OTHER MATCHING RELEASES:*\n\n`;
    otherReleases.slice(0, 4).forEach((item, idx) => {
      const itemHash = getItemHash(item);
      msg += `${idx + 1}. *${item.title}*\n`;
      msg += `   ↳ 📦 ${item.size}  |  🌱 ${item.seeders} seeds\n`;
      if (itemHash) {
        const itemTitle = encodeURIComponent(item.title.slice(0, 50));
        msg += `   👉 https://sauceror.vercel.app/m/${itemHash}?dn=${itemTitle}\n\n`;
      } else if (item.detailUrl) {
        msg += `   👉 ${item.detailUrl}\n\n`;
      }
    });
  }

  msg += `🌐 *Search More on Web:* https://sauceror.vercel.app\n`;
  msg += `🤖 _Built by Sardar Ahmed_`;

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
