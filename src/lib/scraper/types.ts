export interface TorrentItem {
  id: string;
  title: string;
  detailUrl: string;
  category: string;
  subcategory?: string;
  size: string;
  sizeBytes?: number;
  filesCount?: number;
  age: string;
  seeders: number;
  leechers: number;
  sourceTracker?: string;
  uploader?: string;
  magnetUrl?: string;
  infoHash?: string;
}

export interface MagnetResult {
  success: boolean;
  torrentId: string;
  magnetUrl?: string;
  infoHash?: string;
  trackers?: string[];
  title?: string;
  downloads?: number;
  error?: string;
}

export interface SearchOptions {
  category?: string;
  page?: number;
  sortBy?: 'age' | 'seeds' | 'size';
  sortOrder?: 'desc' | 'asc';
  mirror?: string;
}

export interface SearchResult {
  success: boolean;
  query: string;
  total: number;
  items: TorrentItem[];
  mirrorUsed: string;
  page: number;
  error?: string;
}

export interface AgentAction {
  type: 'search' | 'resolve_magnet' | 'answer';
  query?: string;
  torrentId?: string;
  explanation?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  items?: TorrentItem[];
  topPick?: TorrentItem;
  thoughts?: string[];
  status?: 'thinking' | 'searching' | 'resolving' | 'done' | 'error';
}
