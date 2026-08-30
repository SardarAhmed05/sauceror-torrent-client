'use client';

import React, { useState } from 'react';
import {
  Magnet,
  Check,
  Download,
  Film,
  Tv,
  Music,
  Gamepad2,
  Laptop,
  BookOpen,
  Folder,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  HardDrive,
  Clock,
  ExternalLink,
  Sparkles,
  Trophy,
  Flame,
  Radio
} from 'lucide-react';
import { TorrentItem } from '@/lib/scraper/types';

interface TorrentCardProps {
  item: TorrentItem;
  isTopPick?: boolean;
  onMagnetResolved?: (id: string, magnetUrl: string, hash?: string) => void;
}

export const TorrentCard: React.FC<TorrentCardProps> = ({
  item,
  isTopPick = false,
  onMagnetResolved,
}) => {
  const [copied, setCopied] = useState(false);
  const [loadingMagnet, setLoadingMagnet] = useState(false);
  const [magnetUrl, setMagnetUrl] = useState<string | undefined>(item.magnetUrl);
  const [infoHash, setInfoHash] = useState<string | undefined>(item.infoHash);
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getCategoryIcon = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('movie') || lower.includes('video')) return <Film className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.includes('tv') || lower.includes('series')) return <Tv className="w-3.5 h-3.5 text-sky-400" />;
    if (lower.includes('music') || lower.includes('audio')) return <Music className="w-3.5 h-3.5 text-pink-400" />;
    if (lower.includes('game')) return <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (lower.includes('app') || lower.includes('soft') || lower.includes('linux')) return <Laptop className="w-3.5 h-3.5 text-cyan-400" />;
    if (lower.includes('book')) return <BookOpen className="w-3.5 h-3.5 text-indigo-400" />;
    return <Folder className="w-3.5 h-3.5 text-gray-400" />;
  };

  const seedCount = item.seeders || 0;
  const leechCount = item.leechers || 0;

  // Extract clean release group / tracker / resolution tags
  const extractTags = (title: string) => {
    const tags: string[] = [];
    if (/\b(?:2160p|4k|uhd)\b/i.test(title)) tags.push('4K UHD');
    else if (/\b1080p\b/i.test(title)) tags.push('1080p FHD');
    else if (/\b720p\b/i.test(title)) tags.push('720p HD');

    if (/\b(?:bluray|brrip|bdrip|remux)\b/i.test(title)) tags.push('BluRay');
    else if (/\b(?:web-?dl|webrip)\b/i.test(title)) tags.push('WEB-DL');
    else if (/\bhdtv\b/i.test(title)) tags.push('HDTV');

    if (/\b(?:x265|hevc|10bit)\b/i.test(title)) tags.push('HEVC x265');
    else if (/\b(?:x264|h264|avc)\b/i.test(title)) tags.push('x264');
    else if (/\bav1\b/i.test(title)) tags.push('AV1');

    if (/\b(?:yify|yts)\b/i.test(title)) tags.push('YTS');
    else if (/\bgalaxyrg\b/i.test(title)) tags.push('GalaxyRG');
    else if (/\brarbg\b/i.test(title)) tags.push('RARBG');
    else if (/\bethel\b/i.test(title)) tags.push('ETHEL');
    else if (/\bkillers\b/i.test(title)) tags.push('KILLERS');
    else if (/\bpsa\b/i.test(title)) tags.push('PSA');
    else if (/\bqxr|tigole\b/i.test(title)) tags.push('QxR');

    return tags;
  };

  const tags = extractTags(item.title);

  const fetchMagnet = async (): Promise<string | null> => {
    if (magnetUrl) return magnetUrl;

    try {
      setLoadingMagnet(true);
      setErrorMsg(null);

      const res = await fetch('/api/magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          detailUrl: item.detailUrl,
        }),
      });

      const data = await res.json();
      if (data.success && data.magnetUrl) {
        setMagnetUrl(data.magnetUrl);
        setInfoHash(data.infoHash);
        if (onMagnetResolved) {
          onMagnetResolved(item.id, data.magnetUrl, data.infoHash);
        }
        return data.magnetUrl;
      } else {
        setErrorMsg(data.error || 'Could not extract magnet link');
        return null;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch magnet');
      return null;
    } finally {
      setLoadingMagnet(false);
    }
  };

  const handleCopyMagnet = async () => {
    let link = magnetUrl;
    if (!link) {
      link = await fetchMagnet() || undefined;
    }

    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleOpenClient = async () => {
    let link = magnetUrl;
    if (!link) {
      link = await fetchMagnet() || undefined;
    }

    if (link) {
      window.location.href = link;
    }
  };

  // HERO TOP PICK CARD
  if (isTopPick) {
    return (
      <div className="relative rounded-2xl bg-gradient-to-b from-[#1c2233] to-[#121622] border-2 border-amber-500/80 shadow-2xl shadow-amber-500/10 p-4 sm:p-6 space-y-4 overflow-hidden">
        {/* Top Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b354d] pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-black tracking-wider uppercase shadow-md shadow-amber-500/20">
              <Trophy className="w-3.5 h-3.5 fill-black" />
              <span>#1 Top Pick Recommendation</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>Highest Health Swarm</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-emerald-400 font-bold flex items-center gap-1 bg-[#101e28] px-2.5 py-1 rounded-lg border border-emerald-800/40">
              <span className="text-emerald-500">▲</span> {seedCount} Seeds
            </span>
            <span className="text-gray-200 font-bold bg-[#1e2330] px-2.5 py-1 rounded-lg border border-[#2b3245]">
              {item.size}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug break-words">
            {item.title}
          </h2>

          {/* Clean metadata pill tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141721] text-gray-200 font-semibold text-xs border border-[#2b3245]">
              {getCategoryIcon(item.category)}
              <span>{item.category}</span>
            </span>

            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded-lg bg-[#1a2130] text-amber-300 font-semibold text-[11px] border border-amber-500/30"
              >
                {tag}
              </span>
            ))}

            {item.sourceTracker && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#141721] text-gray-300 font-mono text-[11px] uppercase border border-[#2b3245]">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Source: {item.sourceTracker}</span>
              </span>
            )}
          </div>
        </div>

        {/* Hero Actions Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2b354d]">
          {/* Big Magnet Button */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyMagnet}
              disabled={loadingMagnet}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg active:scale-95 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-amber-500/25'
              }`}
            >
              {loadingMagnet ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : copied ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                <Magnet className="w-4 h-4 fill-black" />
              )}
              <span>{loadingMagnet ? 'Resolving Token...' : copied ? 'Magnet Link Copied!' : 'Copy Magnet Link'}</span>
            </button>

            <button
              onClick={handleOpenClient}
              disabled={loadingMagnet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1e2330] hover:bg-[#282e3f] text-gray-200 hover:text-white border border-[#2b3245] transition-all text-xs font-semibold"
              title="Open directly in your torrent client"
            >
              <Download className="w-4 h-4 text-gray-300" />
              <span>Open in App</span>
            </button>
          </div>

          {/* Visit Original Link */}
          <a
            href={item.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141721] hover:bg-[#1a1e2b] text-gray-300 hover:text-white border border-[#2b3245] transition-all text-xs font-medium"
          >
            <span>View on ext.to</span>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </a>
        </div>

        {/* Technical InfoHash expandable */}
        <div className="pt-1 text-[11px] border-t border-[#1e2330] flex items-center justify-between text-gray-400">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1 font-mono text-[11px]"
          >
            <span>BTIH: {infoHash ? infoHash.slice(0, 16) + '...' : 'View InfoHash'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="text-gray-500 font-mono text-[10px]">Verified Swarm</span>
        </div>

        {expanded && (
          <div className="p-3 rounded-xl bg-[#0c0e14] border border-[#232838] text-[11px] space-y-2 font-mono animate-fade-in">
            {infoHash && (
              <div>
                <span className="text-gray-500 block text-[10px]">InfoHash (BTIH):</span>
                <code className="text-amber-400 select-all block truncate text-[11px]">
                  {infoHash}
                </code>
              </div>
            )}
            {magnetUrl && (
              <div>
                <span className="text-gray-500 block text-[10px]">Direct Magnet URI:</span>
                <p className="text-gray-300 text-[10px] bg-[#141721] p-2 rounded border border-[#232838] select-all break-all max-h-24 overflow-y-auto">
                  {magnetUrl}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // STANDARD RELEASE ROW CARD
  return (
    <div className="rounded-xl ext-card p-3 sm:p-4 transition-all duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Info */}
        <div className="space-y-1.5 flex-1 min-w-0">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e2330] text-amber-400 font-semibold border border-[#2b3245]">
              {getCategoryIcon(item.category)}
              <span>{item.category}</span>
            </span>

            {tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded bg-[#181d2a] text-gray-300 font-medium text-[10px] border border-[#2b3245]"
              >
                {tag}
              </span>
            ))}

            {item.sourceTracker && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#141721] text-gray-400 font-mono text-[10px] uppercase border border-[#232838]">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                <span>{item.sourceTracker}</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-100 text-xs sm:text-sm leading-snug break-words">
            {item.title}
          </h3>
        </div>

        {/* Right Info: Stats + Actions */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[#232838]">
          {/* Metrics */}
          <div className="flex items-center gap-2 text-xs shrink-0 font-mono">
            <div className="flex items-center gap-1 font-bold text-gray-200 bg-[#1e2330] px-2.5 py-1 rounded-lg border border-[#2b3245]">
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span>{item.size}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#1e2330] px-2 py-1 rounded-lg border border-[#2b3245] text-[11px]">
              <span className="text-emerald-400 font-bold" title="Seeders">
                ▲ {seedCount}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyMagnet}
              disabled={loadingMagnet}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#232838] hover:bg-amber-500 hover:text-black text-gray-200'
              }`}
              title="Copy Magnet Link"
            >
              {loadingMagnet ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Magnet className="w-3.5 h-3.5" />
              )}
              <span>{loadingMagnet ? 'Resolving...' : copied ? 'Copied' : 'Magnet'}</span>
            </button>

            <button
              onClick={handleOpenClient}
              disabled={loadingMagnet}
              className="p-1.5 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-gray-300 hover:text-white border border-[#2b3245] transition-all text-xs"
              title="Open in Torrent Client"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <a
              href={item.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-gray-300 hover:text-white border border-[#2b3245] transition-all text-[11px] font-semibold"
              title="View release on ext.to"
            >
              <span>ext.to</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
