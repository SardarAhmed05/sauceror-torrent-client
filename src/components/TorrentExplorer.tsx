'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  Filter,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { TorrentItem } from '@/lib/scraper/types';
import { TorrentCard } from './TorrentCard';

interface TorrentExplorerProps {
  activeMirror: string;
}

const CATEGORIES = [
  { id: 'All', label: 'All', icon: '🌐' },
  { id: 'Movies', label: 'Movies', icon: '🎬' },
  { id: 'TV', label: 'TV Shows', icon: '📺' },
  { id: 'Anime', label: 'Anime', icon: '✨' },
];

export const TorrentExplorer: React.FC<TorrentExplorerProps> = ({
  activeMirror,
}) => {
  const [query, setQuery] = useState('Interstellar');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'seeds' | 'age' | 'size'>('seeds');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TorrentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minSeeds, setMinSeeds] = useState<number>(0);
  const [selectedQuality, setSelectedQuality] = useState<string>('all');

  const executeSearch = async (targetQuery?: string, targetPage = 1, targetCat?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const cat = targetCat !== undefined ? targetCat : activeCategory;
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          category: cat !== 'All' ? cat : undefined,
          page: targetPage,
          sortBy,
          sortOrder,
          mirror: activeMirror,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setItems(json.items || []);
        setPage(targetPage);
      } else {
        setError(json.error || 'Failed to search ext.to');
        setItems([]);
      }
    } catch (err: any) {
      setError(err.message || 'Network error performing search');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch('ubuntu', 1, 'All');
  }, [activeMirror]);

  const filteredItems = items.filter((item) => {
    if (minSeeds > 0 && (item.seeders || 0) < minSeeds) return false;
    if (selectedQuality !== 'all') {
      const titleLower = item.title.toLowerCase();
      if (!titleLower.includes(selectedQuality.toLowerCase())) return false;
    }
    return true;
  });

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    setPage(1);
    executeSearch(query, 1, catId);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Search Header Bar */}
      <div className="ext-card rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded">EXT</span>
              <span>Browse &amp; Search Torrents</span>
            </h1>
            <p className="text-xs text-gray-400">
              Live index from {activeMirror.replace('https://', '')} with on-demand verified magnet resolution
            </p>
          </div>
        </div>

        {/* Search Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, TV shows, games, Linux ISOs, ebooks..."
              className="w-full bg-[#0c0e14] border border-[#232838] rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-xs sm:text-sm transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-[#1e2330] text-black font-bold shadow-sm transition-all active:scale-95 text-xs sm:text-sm shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-black shadow-sm font-bold'
                  : 'bg-[#1e2330] text-gray-400 hover:text-gray-200 border border-[#2b3245]'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-bold text-gray-200">
            {filteredItems.length} {filteredItems.length === 1 ? 'Release' : 'Releases'}
          </span>
          <span className="text-gray-600">|</span>
          <span>Page {page}</span>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quality Filter */}
          <div className="flex items-center gap-1 bg-[#141721] p-1 rounded-lg border border-[#232838] text-xs">
            {['all', '1080p', '4k', '720p'].map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuality(q)}
                className={`px-2 py-0.5 rounded font-semibold text-[11px] transition-all ${
                  selectedQuality === q
                    ? 'bg-amber-500 text-black'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {q.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Min Seeds Filter */}
          <div className="flex items-center gap-1.5 bg-[#141721] px-2.5 py-1 rounded-lg border border-[#232838] text-xs text-gray-300">
            <Filter className="w-3 h-3 text-amber-400" />
            <span className="text-[11px]">Min Seeds:</span>
            <select
              value={minSeeds}
              onChange={(e) => setMinSeeds(Number(e.target.value))}
              className="bg-transparent text-white font-semibold text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="0" className="bg-[#141721]">Any</option>
              <option value="5" className="bg-[#141721]">5+ Seeds</option>
              <option value="20" className="bg-[#141721]">20+ Seeds</option>
              <option value="50" className="bg-[#141721]">50+ Seeds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Container */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-gray-400">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          <p className="text-xs font-medium">Scraping ext.to mirror...</p>
        </div>
      ) : error ? (
        <div className="ext-card rounded-xl p-6 text-center max-w-md mx-auto space-y-3 border-rose-500/30">
          <p className="text-rose-400 font-semibold text-xs">{error}</p>
          <button
            onClick={() => executeSearch()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1e2330] text-xs text-gray-200 hover:bg-[#282e3f] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="ext-card rounded-xl p-10 text-center max-w-md mx-auto space-y-2">
          <FolderOpen className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="font-semibold text-white text-sm">No Torrents Found</h3>
          <p className="text-xs text-gray-400">
            No active releases matched your search criteria. Try different keywords.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, idx) => (
            <TorrentCard
              key={item.id || idx}
              item={item}
              isTopPick={idx === 0 && page === 1}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredItems.length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-4 pb-8">
          <button
            onClick={() => executeSearch(query, Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            className="px-3.5 py-1.5 rounded-lg bg-[#141721] border border-[#232838] text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1e2330] disabled:opacity-40 transition-all"
          >
            Prev
          </button>
          <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#1e2330] text-amber-400">
            {page}
          </span>
          <button
            onClick={() => executeSearch(query, page + 1)}
            disabled={loading || filteredItems.length < 15}
            className="px-3.5 py-1.5 rounded-lg bg-[#141721] border border-[#232838] text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1e2330] disabled:opacity-40 transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
