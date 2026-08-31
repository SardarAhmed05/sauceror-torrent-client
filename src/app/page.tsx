'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChatInterface } from '@/components/ChatInterface';
import { TorrentExplorer } from '@/components/TorrentExplorer';
import { WhatsAppSimulator } from '@/components/WhatsAppSimulator';
import { SettingsModal } from '@/components/SettingsModal';
import { DEFAULT_MIRRORS } from '@/lib/scraper/mirrors';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'explorer' | 'whatsapp'>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [activeMirror, setActiveMirror] = useState(DEFAULT_MIRRORS[0]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('sauceror_gemini_key');
      if (savedKey) setApiKey(savedKey);

      const savedMirror = localStorage.getItem('sauceror_mirror');
      if (savedMirror) setActiveMirror(savedMirror);
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-[#0b0f19] text-gray-100 font-sans">
      {/* Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeMirror={activeMirror}
      />

      {/* Main Tab Views - Kept mounted to preserve state across tab switches */}
      <div className="flex-1 flex flex-col">
        <div className={`flex-1 flex flex-col ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
          <ChatInterface apiKey={apiKey} activeMirror={activeMirror} />
        </div>

        <div className={`flex-1 flex flex-col ${activeTab === 'explorer' ? 'block' : 'hidden'}`}>
          <TorrentExplorer activeMirror={activeMirror} />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        activeMirror={activeMirror}
        setActiveMirror={setActiveMirror}
      />
    </main>
  );
}
