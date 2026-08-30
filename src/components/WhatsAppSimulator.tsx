'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Smartphone,
  Check,
  CheckCheck,
  Copy,
  ShieldCheck,
  Zap,
  Loader2,
  Phone,
  Video,
  MoreVertical,
  Radio,
  ArrowRight
} from 'lucide-react';

interface WAMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
}

export const WhatsAppSimulator: React.FC = () => {
  const [messages, setMessages] = useState<WAMessage[]>([
    {
      id: 'wa-1',
      sender: 'bot',
      text:
        '👋 *Welcome to Sauceror on WhatsApp!*\n\n' +
        'Send any title to get verified *ext.to* magnet links.\n\n' +
        '💡 *Examples:*\n' +
        '• `Interstellar 1080p under 2 gbs`\n' +
        '• `Ubuntu 24.04 desktop iso`\n' +
        '• `Python cookbook pdf`\n\n' +
        'Just text me what you need!',
      time: '12:00 PM',
      status: 'read',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedVerify, setCopiedVerify] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'meta' | 'twilio' | 'curl'>('meta');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const getTimeString = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || input).trim();
    if (!text || loading) return;

    const userMsg: WAMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: getTimeString(),
      status: 'read',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMessage: text,
          from: '+14155238886',
        }),
      });

      const json = await res.json();
      if (json.success && json.message) {
        const botMsg: WAMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: json.message,
          time: getTimeString(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errMsg: WAMessage = {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ *Error:* ${json.error || 'Failed to process request on ext.to'}`,
          time: getTimeString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (err: any) {
      const netErrMsg: WAMessage = {
        id: `bot-net-err-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ *Network Error:* ${err.message}`,
        time: getTimeString(),
      };
      setMessages((prev) => [...prev, netErrMsg]);
    } finally {
      setLoading(false);
    }
  };

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app';
  const webhookUrl = `${currentOrigin}/api/whatsapp`;
  const verifyToken = 'sauceror_verify_token';

  const copyToClipboard = (text: string, type: 'webhook' | 'verify') => {
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedVerify(true);
      setTimeout(() => setCopiedVerify(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="ext-card rounded-2xl p-4 sm:p-6 space-y-2">
        <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span className="bg-emerald-600 text-white text-xs font-black px-2 py-0.5 rounded">WA</span>
          <span>WhatsApp Bot &amp; Webhook Integration</span>
        </h1>
        <p className="text-xs text-gray-400">
          Search ext.to and get verified magnet links directly in WhatsApp on your phone.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Phone Mockup */}
        <div className="lg:col-span-5 flex justify-center w-full">
          <div className="w-full max-w-[360px] rounded-[36px] p-2.5 bg-[#181d2a] border-2 border-[#2b3245] shadow-2xl">
            {/* Phone Screen */}
            <div className="w-full h-[560px] rounded-[28px] bg-[#0c1317] flex flex-col overflow-hidden relative shadow-inner">
              {/* WhatsApp Header */}
              <div className="bg-[#1f2c34] px-3.5 py-2.5 flex items-center justify-between text-white border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-[10px] shadow-sm">
                    EXT
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-xs">Sauceror Bot</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      online
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-gray-400">
                  <Video className="w-3.5 h-3.5" />
                  <Phone className="w-3.5 h-3.5" />
                  <MoreVertical className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Chat Messages Container */}
              <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 bg-[#0b141a]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl p-2.5 text-[11px] leading-relaxed shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-[#005c4b] text-emerald-50 rounded-tr-none'
                          : 'bg-[#202c33] text-gray-100 rounded-tl-none border border-gray-800/40'
                      }`}
                    >
                      <div
                        className="whitespace-pre-wrap font-sans break-words"
                        dangerouslySetInnerHTML={{
                          __html: msg.text
                            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                            .replace(/_(.*?)_/g, '<em>$1</em>')
                            .replace(/```([\s\S]*?)```/g, '<div class="bg-[#111b21] p-1.5 rounded my-1 font-mono text-[9px] text-amber-300 break-all select-all">$1</div>')
                            .replace(/`([^`]+)`/g, '<code class="bg-[#111b21] text-amber-300 px-1 py-0.5 rounded text-[10px] font-mono">$1</code>'),
                        }}
                      />
                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-gray-400">
                        <span>{msg.time}</span>
                        {msg.sender === 'user' && (
                          <CheckCheck className="w-3 h-3 text-cyan-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-1.5 bg-[#202c33] text-gray-300 px-2.5 py-1.5 rounded-lg rounded-tl-none text-[10px] w-max border border-gray-800">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span>Sauceror is typing...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Bottom Input */}
              <div className="bg-[#1f2c34] p-2 flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Type a movie or software name..."
                  disabled={loading}
                  className="flex-1 bg-[#2a3942] text-white placeholder-gray-400 text-xs rounded-full px-3 py-2 focus:outline-none"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#029071] disabled:bg-gray-700 text-white flex items-center justify-center transition-all shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Webhook Setup */}
        <div className="lg:col-span-7 space-y-4">
          {/* Sample Prompts */}
          <div className="ext-card rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate WhatsApp Messages</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Interstellar 1080p under 2 gbs',
                'Ubuntu 24.04 desktop iso',
                'Python Cookbook 3rd Edition pdf',
                'Cyberpunk 2077 pc',
                'Help',
              ].map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(sample)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-[11px] font-medium text-gray-200 border border-[#2b3245] transition-all flex items-center gap-1"
                >
                  <span>{sample}</span>
                  <ArrowRight className="w-3 h-3 text-amber-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Webhook Configuration Parameters */}
          <div className="ext-card rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Your Vercel Webhook Endpoint</span>
            </h3>

            {/* Webhook URL */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400 font-semibold block">Webhook Callback URL</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-[#0c0e14] border border-[#232838] rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-400 select-all focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-1 shrink-0"
                >
                  {copiedWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Verify Token */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400 font-semibold block">Verify Token (hub.verify_token)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={verifyToken}
                  className="flex-1 bg-[#0c0e14] border border-[#232838] rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-200 select-all focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(verifyToken, 'verify')}
                  className="px-3 py-1.5 rounded-lg bg-[#1e2330] hover:bg-[#282e3f] text-gray-200 text-xs font-semibold transition-all flex items-center gap-1 shrink-0 border border-[#2b3245]"
                >
                  {copiedVerify ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedVerify ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="ext-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-[#232838] pb-2">
              <button
                onClick={() => setActiveGuideTab('meta')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  activeGuideTab === 'meta' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Meta Cloud API
              </button>
              <button
                onClick={() => setActiveGuideTab('twilio')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  activeGuideTab === 'twilio' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Twilio
              </button>
              <button
                onClick={() => setActiveGuideTab('curl')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  activeGuideTab === 'curl' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                cURL
              </button>
            </div>

            {activeGuideTab === 'meta' && (
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-400">
                <li>Under <strong className="text-white">Meta Developer Dashboard &gt; WhatsApp &gt; Configuration</strong>.</li>
                <li>Set Webhook URL to <code className="text-emerald-400">{webhookUrl}</code> and Verify Token to <code className="text-emerald-400">{verifyToken}</code>.</li>
                <li>Subscribe to the <strong className="text-white">messages</strong> field.</li>
              </ol>
            )}

            {activeGuideTab === 'twilio' && (
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-400">
                <li>In <strong className="text-white">Twilio Console &gt; Messaging &gt; WhatsApp Sandbox</strong>.</li>
                <li>Set <strong className="text-white">"When a message comes in"</strong> to <code className="text-emerald-400">{webhookUrl}</code> (POST).</li>
              </ol>
            )}

            {activeGuideTab === 'curl' && (
              <pre className="bg-[#0c0e14] p-2.5 rounded-lg border border-[#232838] text-[10px] font-mono text-emerald-400 overflow-x-auto select-all">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"testMessage": "Interstellar 1080p under 2 gbs"}'`}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
