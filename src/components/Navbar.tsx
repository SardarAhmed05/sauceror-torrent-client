'use client';

import React from 'react';
import { Bot, Search, MessageSquare, Settings, Radio, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'explorer' | 'whatsapp';
  setActiveTab: (tab: 'chat' | 'explorer' | 'whatsapp') => void;
  onOpenSettings: () => void;
  activeMirror: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  activeMirror,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full ext-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 relative flex items-center justify-between gap-2">
        {/* Brand Logo - Film Reel identity */}
        <div className="flex items-center gap-2.5 shrink-0 z-10">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('chat')}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center shadow-sm">
              <img src="/icon.svg" alt="Sauceror" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
              SAUCEROR
            </span>
          </div>
          <span className="hidden md:inline-block text-[11px] font-medium text-gray-400 pl-2 border-l border-gray-800">
            AI Torrent Index
          </span>
          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            v1.4.6
          </span>
        </div>

        {/* Center Tabs - Perfectly Center Aligned */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 rounded-xl bg-[#141721] border border-[#232838] shadow-sm z-10">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'chat'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e2b]'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>AI Discovery</span>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'explorer'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e2b]'
            }`}
          >
            <Search className="w-4 h-4 shrink-0" />
            <span>Browse</span>
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Mirror Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141721] border border-[#232838] text-[11px] font-medium text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeMirror.replace('https://', '')}</span>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a1e2b] border border-transparent hover:border-[#232838] transition-all"
            title="Settings & Mirror Configuration"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
