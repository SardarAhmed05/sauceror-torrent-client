import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sauceror AI Agent | ext.to Scraper & Magnet Extractor',
  description: 'Autonomous AI Agent and WhatsApp Bot that scrapes ext.to and provides direct magnet download links with health metrics.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  other: {
    'google-adsense-account': 'ca-pub-4863342960049409',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4863342960049409"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-[#0b0f19] text-gray-100 min-h-screen selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
