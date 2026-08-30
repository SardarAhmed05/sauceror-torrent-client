'use client';

import React, { useState } from 'react';
import {
  X,
  Key,
  Globe,
  Check,
  Radio,
  ExternalLink,
  Loader2,
  Info
} from 'lucide-react';
import { DEFAULT_MIRRORS } from '@/lib/scraper/mirrors';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  activeMirror: string;
  setActiveMirror: (mirror: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  activeMirror,
  setActiveMirror,
}) => {
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempMirror, setTempMirror] = useState(activeMirror);
  const [testingMirror, setTestingMirror] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleTestMirror = async () => {
    setTestingMirror(true);
    setMirrorStatus(null);
    const start = Date.now();

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'ubuntu',
          mirror: tempMirror,
        }),
      });

      const latency = Date.now() - start;
      const json = await res.json();
      if (json.success) {
        setMirrorStatus(`✅ Online (${latency}ms) - Mirror responding normally`);
      } else {
        setMirrorStatus(`⚠️ Mirror issue: ${json.error}`);
      }
    } catch (err: any) {
      setMirrorStatus(`❌ Connection error: ${err.message}`);
    } finally {
      setTestingMirror(false);
    }
  };

  const handleSave = () => {
    setApiKey(tempApiKey.trim());
    setActiveMirror(tempMirror.trim());
    if (typeof window !== 'undefined') {
      localStorage.setItem('sauceror_gemini_key', tempApiKey.trim());
      localStorage.setItem('sauceror_mirror', tempMirror.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-[#141721] border border-[#232838] shadow-2xl p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-black font-black text-xs px-2 py-0.5 rounded">EXT</span>
            <h2 className="font-bold text-white text-sm sm:text-base">Settings &amp; Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2330] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Google Gemini API Key (Optional)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-400 hover:underline inline-flex items-center gap-0.5"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="AIzaSy... (Leave empty to use built-in smart parser)"
              className="w-full bg-[#0c0e14] border border-[#232838] rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
            <div className="flex items-start gap-1.5 text-[11px] text-gray-400 bg-[#0c0e14] p-2 rounded-lg border border-[#232838]">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Even without an API key, Sauceror uses its built-in deterministic NLP engine to parse all constraints and scrape ext.to.
              </span>
            </div>
          </div>

          {/* Mirror Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-gray-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active ext.to Mirror</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEFAULT_MIRRORS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTempMirror(m)}
                  className={`p-2 rounded-lg border text-xs font-semibold text-left transition-all ${
                    tempMirror === m
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                      : 'bg-[#0c0e14] border-[#232838] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div>{m.replace('https://', '')}</div>
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={tempMirror}
                onChange={(e) => setTempMirror(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-[#0c0e14] border border-[#232838] rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleTestMirror}
                disabled={testingMirror}
                className="px-3 py-1.5 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-xs font-semibold text-gray-200 transition-colors flex items-center gap-1 shrink-0 border border-[#2b3245]"
              >
                {testingMirror ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                <span>Ping</span>
              </button>
            </div>

            {mirrorStatus && (
              <p className="text-[11px] text-gray-300 bg-[#0c0e14] p-2 rounded-lg border border-[#232838]">
                {mirrorStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#232838]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#1e2330] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center gap-1"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{savedSuccess ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
