'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Download, Copy, Check, ArrowLeft, Shield } from 'lucide-react';

const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.zerobytes.xyz:1337/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://9.rarbg.to:2710/announce',
];

export default function MagnetRedirectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const hash = (params?.hash as string) || '';
  const title = searchParams?.get('dn') || 'Torrent Download';

  const trackerParams = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  const magnetUrl = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${trackerParams}`;

  useEffect(() => {
    if (hash && typeof window !== 'undefined') {
      try {
        // Instant trigger with 0 delay
        window.location.href = magnetUrl;
      } catch (e) {}
    }
  }, [hash, magnetUrl]);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(magnetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenApp = () => {
    window.location.href = magnetUrl;
  };

  return (
    <div className="min-h-screen bg-[#0c0e14] text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141824] border border-[#232838] rounded-2xl p-6 shadow-2xl space-y-6 text-center animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <img src="/icon.svg" alt="Sauceror" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            1-Click Torrent Launcher
          </span>
          <h1 className="text-base sm:text-lg font-bold text-white leading-snug pt-2">
            {title}
          </h1>
          <p className="text-xs text-gray-400 font-mono break-all pt-1">
            BTIH: {hash}
          </p>
        </div>

        {/* Launch Status */}
        <div className="p-3 bg-[#0c0e14] border border-[#232838] rounded-xl text-xs text-gray-300 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Opening your torrent client...</span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleOpenApp}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-extrabold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Open in Torrent Client</span>
          </button>

          <button
            onClick={handleCopy}
            className="w-full py-3 px-4 bg-[#232838] hover:bg-[#2b3245] text-gray-200 font-bold rounded-xl border border-[#3b4359] flex items-center justify-center gap-2 transition-all text-xs"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Magnet Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy Full Magnet Link</span>
              </>
            )}
          </button>
        </div>

        {/* App Recommendations */}
        <div className="pt-2 border-t border-[#232838] text-[11px] text-gray-400 space-y-1">
          <p className="flex items-center justify-center gap-1 text-gray-400">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Compatible with Flud, uTorrent, LibreTorrent, qBittorrent</span>
          </p>
        </div>

        {/* Return to App */}
        <div className="pt-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Sauceror Search</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
