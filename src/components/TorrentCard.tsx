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
  Sparkles
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
    const lower = cat.toLowerCase();
    if (lower.includes('movie')) return <Film className="w-3.5 h-3.5" />;
    if (lower.includes('tv')) return <Tv className="w-3.5 h-3.5" />;
    if (lower.includes('music')) return <Music className="w-3.5 h-3.5" />;
    if (lower.includes('game')) return <Gamepad2 className="w-3.5 h-3.5" />;
    if (lower.includes('app') || lower.includes('soft') || lower.includes('linux')) return <Laptop className="w-3.5 h-3.5" />;
    if (lower.includes('book')) return <BookOpen className="w-3.5 h-3.5" />;
    return <Folder className="w-3.5 h-3.5" />;
  };

  const seedCount = item.seeders || 0;
  const leechCount = item.leechers || 0;

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

  return (
    <div
      className={`rounded-xl transition-all duration-200 overflow-hidden ${
        isTopPick
          ? 'bg-[#181d2a] border-2 border-amber-500/70 shadow-lg shadow-amber-500/5 p-4 sm:p-5 relative'
          : 'ext-card p-3.5 sm:p-4'
      }`}
    >
      {/* Top Pick Ribbon */}
      {isTopPick && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black tracking-wider uppercase mb-2 shadow-sm">
          <Sparkles className="w-3 h-3 fill-black" />
          <span>Top Pick</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Info: Category, Title, Uploader, Source */}
        <div className="space-y-1.5 flex-1 min-w-0">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {/* Category */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e2330] text-amber-400 font-semibold border border-[#2b3245]">
              {getCategoryIcon(item.category)}
              <span>{item.category}</span>
              {item.subcategory && <span className="text-gray-400 font-normal">/ {item.subcategory}</span>}
            </span>

            {/* Source Tracker */}
            {item.sourceTracker && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#141721] text-gray-300 font-mono text-[10px] uppercase border border-[#232838]">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                {item.sourceTracker}
              </span>
            )}

            {/* Age */}
            <span className="text-gray-400 text-[11px] flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-500" />
              <span>{item.age}</span>
            </span>

            {item.uploader && (
              <span className="text-gray-500 text-[11px] hidden sm:inline">
                by <span className="text-gray-400">{item.uploader}</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={`font-semibold text-gray-100 leading-snug break-words ${
              isTopPick ? 'text-sm sm:text-base font-bold text-white' : 'text-xs sm:text-sm'
            }`}
          >
            {item.title}
          </h3>
        </div>

        {/* Right Info: Stats (Size, Seeds, Leechs) + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[#232838]">
          {/* Metrics (Size, Seeds, Leechs) */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            {/* Size */}
            <div className="flex items-center gap-1 font-mono font-bold text-gray-200 bg-[#1e2330] px-2.5 py-1 rounded-lg border border-[#2b3245]">
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span>{item.size}</span>
            </div>

            {/* Seeds & Leechs */}
            <div className="flex items-center gap-2 bg-[#1e2330] px-2.5 py-1 rounded-lg border border-[#2b3245] font-mono text-[11px]">
              <span className="text-emerald-400 font-bold flex items-center gap-0.5" title="Seeders">
                <span className="text-emerald-500 font-normal">▲</span> {seedCount}
              </span>
              <span className="text-gray-600">/</span>
              <span className="text-rose-400 font-bold flex items-center gap-0.5" title="Leechers">
                <span className="text-rose-500 font-normal">▼</span> {leechCount}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Magnet Button */}
            <button
              onClick={handleCopyMagnet}
              disabled={loadingMagnet}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : isTopPick
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
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
              <span>{loadingMagnet ? 'Resolving...' : copied ? 'Copied!' : 'Magnet'}</span>
            </button>

            {/* Open Client Button */}
            <button
              onClick={handleOpenClient}
              disabled={loadingMagnet}
              className="p-1.5 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-gray-300 hover:text-white border border-[#2b3245] transition-all text-xs"
              title="Open in Torrent Client (qBittorrent / uTorrent)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Professional 'Visit Original' Text Link */}
            <a
              href={item.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-gray-300 hover:text-white border border-[#2b3245] transition-all text-[11px] font-semibold shrink-0"
              title="Visit original page on ext.to"
            >
              <span>Visit Original</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mt-2 text-[11px] text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-2.5 py-1">
          {errorMsg}
        </div>
      )}

      {/* Technical Details Toggle */}
      <div className="mt-2 pt-1 border-t border-[#1e2330] flex items-center justify-between text-[11px]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 text-[10px]"
        >
          <span>InfoHash &amp; Trackers</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {infoHash && !expanded && (
          <span className="font-mono text-[10px] text-gray-500 truncate max-w-[150px] sm:max-w-xs">
            BTIH: {infoHash}
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-[#0c0e14] border border-[#232838] text-[11px] space-y-2 font-mono animate-fade-in">
          {infoHash ? (
            <div>
              <span className="text-gray-500 block text-[10px]">InfoHash (BTIH):</span>
              <code className="text-amber-400 select-all block truncate text-[11px]">
                {infoHash}
              </code>
            </div>
          ) : (
            <p className="text-gray-500 text-[10px]">InfoHash will display once magnet link is resolved.</p>
          )}

          {magnetUrl && (
            <div>
              <span className="text-gray-500 block text-[10px]">Direct Magnet URI:</span>
              <p className="text-gray-300 text-[10px] bg-[#141721] p-2 rounded border border-[#232838] select-all break-all max-h-20 overflow-y-auto">
                {magnetUrl}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
            <span>Torrent ID: {item.id}</span>
            <span>Files: {item.filesCount ?? 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
