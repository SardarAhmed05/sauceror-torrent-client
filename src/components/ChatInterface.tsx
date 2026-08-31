'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Trash2,
  Brain,
  ArrowRight,
  Flame,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
  Github,
  ExternalLink
} from 'lucide-react';
import { TorrentItem, AgentMessage } from '@/lib/scraper/types';
import { TorrentCard } from './TorrentCard';

interface ChatInterfaceProps {
  apiKey?: string;
  activeMirror: string;
}

const renderMarkdown = (content: string) => {
  if (!content) return '';

  const lines = content.split('\n');
  const formattedLines: string[] = [];
  let blockquoteContent: string[] = [];

  const flushBlockquote = () => {
    if (blockquoteContent.length > 0) {
      formattedLines.push(
        `<div class="my-2.5 p-3 rounded-xl bg-[#141824] border border-amber-500/30 text-xs text-gray-300 leading-relaxed shadow-sm">` +
          `<div>${blockquoteContent.join('<br />')}</div>` +
          `</div>`
      );
      blockquoteContent = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('> ') || line.startsWith('>')) {
      const text = line.replace(/^>\s*/, '').trim();
      blockquoteContent.push(
        text
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em class="text-amber-300 not-italic font-medium">$1</em>')
          .replace(/`([^`]+)`/g, '<code class="bg-[#0c0e14] text-amber-400 px-1.5 py-0.5 rounded text-xs border border-[#232838] font-mono">$1</code>')
      );
    } else {
      flushBlockquote();
      formattedLines.push(
        line
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em class="text-amber-300 not-italic font-medium">$1</em>')
          .replace(/`([^`]+)`/g, '<code class="bg-[#0c0e14] text-amber-400 px-1.5 py-0.5 rounded text-xs border border-[#232838] font-mono">$1</code>')
      );
    }
  }
  flushBlockquote();

  return formattedLines.join('<br />');
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  apiKey,
  activeMirror,
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        '👋 **Welcome to Sauceror**, your AI-powered torrent search engine.\n\nEnter what you want to download (e.g. *"Interstellar 1080p under 2 gbs"*, *"Game of Thrones Season 1"*, *"Dune Part Two ( 2024 )"*). I will extract verified releases, verify seeds/sizes, and provide instant magnet links.\n\n> 💡 **Note on Torrent Sizes & Searches**: File sizes for multi-episode series and season packs may reflect individual episode streams or full collection archives. If a rare release doesn\'t show up, try adding the release year (e.g. *"Dune Part Two ( 2024 )"* or *"House Season 1"*).',
      timestamp: Date.now(),
      status: 'done',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentThoughts, setCurrentThoughts] = useState<string[]>([]);
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Restore chat messages from sessionStorage on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('sauceror_session_msgs');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Save chat messages to sessionStorage when updated
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        sessionStorage.setItem('sauceror_session_msgs', JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentThoughts, loading]);

  const quickPrompts = [
    { label: 'Interstellar 1080p under 2 gbs', icon: '🎬' },
    { label: 'Game of Thrones Season 1', icon: '📺' },
    { label: 'Dune Part Two ( 2024 )', icon: '🍿' },
    { label: 'House Season 1', icon: '🩺' },
  ];

  const toggleExpand = (msgId: string) => {
    setExpandedLists((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `agent-${Date.now()}`;

    const userMsg: AgentMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const agentPlaceholder: AgentMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'thinking',
    };

    setMessages((prev) => [...prev, userMsg, agentPlaceholder]);
    setInput('');
    setLoading(true);
    setCurrentThoughts(['Searching ext.to and analyzing query...']);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          apiKey: apiKey || undefined,
          mirror: activeMirror,
          autoResolve: true,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        const data = json.data;
        setCurrentThoughts(data.thoughts || []);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: data.summary || 'Here are the matching releases found on ext.to:',
                  items: data.items,
                  topPick: data.topPick,
                  thoughts: data.thoughts,
                  status: 'done',
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `❌ **Error:** ${json.error || 'Failed to complete search on ext.to.'}`,
                  status: 'error',
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `❌ **Network Error:** ${err.message || 'Could not connect to backend server.'}`,
                status: 'error',
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Chat cleared. What else would you like to search on ext.to?',
        timestamp: Date.now(),
        status: 'done',
      },
    ]);
  };

  const handleMagnetResolved = (torrentId: string, magnetUrl: string, hash?: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.items) return msg;
        return {
          ...msg,
          items: msg.items.map((it) =>
            it.id === torrentId ? { ...it, magnetUrl, infoHash: hash } : it
          ),
          topPick:
            msg.topPick?.id === torrentId
              ? { ...msg.topPick, magnetUrl, infoHash: hash }
              : msg.topPick,
        };
      })
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] max-w-5xl mx-auto p-2 sm:p-4">
      {/* Top Header Bar with Clear Action */}
      {messages.length > 1 && (
        <div className="flex items-center justify-between px-2 pb-2 text-xs text-gray-400 border-b border-[#1e2330] mb-2">
          <span className="flex items-center gap-1.5 font-medium text-gray-400">
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span>Search Session</span>
          </span>
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
            title="Reset and clear current conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </button>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.map((msg) => {
          const isExpanded = expandedLists[msg.id] || false;
          const otherItems = msg.items ? msg.items.filter((it) => it.id !== msg.topPick?.id) : [];
          const displayedOtherItems = isExpanded ? otherItems : otherItems.slice(0, 5);

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 animate-fade-in ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* Assistant Icon */}
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <img src="/icon.svg" alt="Sauceror" className="w-full h-full object-contain" />
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                className={`max-w-[96%] sm:max-w-[90%] space-y-2.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="bg-[#232838] border border-[#2b3245] text-white rounded-xl rounded-tr-none px-4 py-2.5 text-xs sm:text-sm font-medium">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Agent Thoughts Box */}
                    {msg.status === 'thinking' && (
                      <div className="ext-card rounded-xl p-3.5 space-y-2 border-amber-500/30">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                          <Brain className="w-3.5 h-3.5 animate-pulse" />
                          <span>Searching &amp; Filtering verified indexers...</span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-400 pl-4 border-l-2 border-amber-500/40">
                          {currentThoughts.map((t, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assistant response text */}
                    {msg.content && (
                      <div className="ext-card rounded-xl p-3.5 text-xs sm:text-sm text-gray-200 leading-relaxed">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(msg.content),
                          }}
                        />
                      </div>
                    )}

                    {/* Top Pick Torrent Card */}
                    {msg.topPick && (
                      <div>
                        <TorrentCard
                          item={msg.topPick}
                          isTopPick={true}
                          onMagnetResolved={handleMagnetResolved}
                        />
                      </div>
                    )}

                    {/* Complete List of Releases for the Same Title */}
                    {otherItems.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-1">
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            <span>Other Matching Releases ({otherItems.length})</span>
                          </div>
                          {otherItems.length > 5 && (
                            <button
                              onClick={() => toggleExpand(msg.id)}
                              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                            >
                              <span>{isExpanded ? 'Show Less' : `Show All (${otherItems.length})`}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {displayedOtherItems.map((item) => (
                            <TorrentCard
                              key={item.id}
                              item={item}
                              isTopPick={false}
                              onMagnetResolved={handleMagnetResolved}
                            />
                          ))}
                        </div>

                        {!isExpanded && otherItems.length > 5 && (
                          <div className="pt-1 text-center">
                            <button
                              onClick={() => toggleExpand(msg.id)}
                              className="px-4 py-1.5 rounded-lg bg-[#141721] hover:bg-[#1e2330] text-xs font-semibold text-amber-400 hover:text-amber-300 border border-[#232838] transition-all inline-flex items-center gap-1.5"
                            >
                              <span>View {otherItems.length - 5} More Releases</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#232838] border border-[#2b3245] flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts on initial screen */}
      {messages.length <= 1 && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium px-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Popular search examples:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp.label)}
                className="flex items-center gap-2 p-2.5 rounded-lg ext-card text-xs text-gray-300 hover:text-white text-left transition-all group"
              >
                <span className="text-base">{qp.icon}</span>
                <span className="truncate flex-1 font-medium">{qp.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-amber-400 shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="relative pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center gap-2 rounded-xl ext-card p-1.5 sm:p-2 border-[#232838] focus-within:border-amber-500/70 transition-all"
        >
          {messages.length > 1 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="p-2 text-gray-500 hover:text-rose-400 hover:bg-[#1a1e2b] rounded-lg transition-colors shrink-0"
              title="Clear Chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search movie, show, ISO, book (e.g. 'Interstellar 1080p under 2 GB')..."
            disabled={loading}
            className="flex-1 bg-transparent px-2.5 py-2 text-xs sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-[#1e2330] disabled:text-gray-500 text-black font-bold shadow-sm transition-all active:scale-95 shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 px-2 pt-2 gap-2">
          <div className="flex items-center gap-3">
            <span>Mirror: {activeMirror.replace('https://', '')}</span>
            <span className="text-gray-700 hidden sm:inline">•</span>
            <span className="text-emerald-400 font-medium hidden sm:flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Verified Magnet Engine
            </span>
          </div>

          <a
            href="https://github.com/SardarAhmed05"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141721] hover:bg-[#1e2330] text-gray-300 hover:text-amber-400 border border-[#232838] transition-all font-medium group"
          >
            <Github className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-400" />
            <span>Built by <strong className="text-gray-200 group-hover:text-amber-400 font-bold">Sardar Ahmed</strong></span>
            <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-amber-400" />
          </a>
        </div>
      </div>
    </div>
  );
};
