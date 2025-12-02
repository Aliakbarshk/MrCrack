
export interface MessageLog {
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: Date;
}

export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    ERROR = 'ERROR'
}

export interface VideoState {
    isActive: boolean;
    url: string | null;
    query: string | null;
}

export type CanvasItemType = 'note' | 'image' | 'routine' | 'suggestion' | 'spreadsheet';

export interface CanvasItem {
    id: string;
    type: CanvasItemType;
    title: string;
    content: string; // Text content, Image URL, or CSV data
    timestamp: Date;
}

export interface SessionData {
    id: string;
    startTime: number;
    endTime?: number;
    logs: MessageLog[];
    canvasItems: CanvasItem[]; // Renamed from notes
}

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

export interface SiteConfig {
    url: string;
    searchTemplate?: string;
}

export const SUPPORTED_APPS: Record<string, SiteConfig> = {
    'canva': { url: 'https://www.canva.com', searchTemplate: 'https://www.canva.com/search?q=' },
    'google': { url: 'https://www.google.com', searchTemplate: 'https://www.google.com/search?q=' },
    'youtube': { url: 'https://www.youtube.com', searchTemplate: 'https://www.youtube.com/results?search_query=' },
    'twitter': { url: 'https://www.twitter.com', searchTemplate: 'https://twitter.com/search?q=' },
    'x': { url: 'https://www.x.com', searchTemplate: 'https://x.com/search?q=' },
    'github': { url: 'https://www.github.com', searchTemplate: 'https://github.com/search?q=' },
    'gmail': { url: 'https://mail.google.com', searchTemplate: 'https://mail.google.com/mail/u/0/#search/' },
    'calendar': { url: 'https://calendar.google.com', searchTemplate: 'https://calendar.google.com/calendar/r/search?q=' },
    'spotify': { url: 'https://open.spotify.com', searchTemplate: 'https://open.spotify.com/search/' },
    'chatgpt': { url: 'https://chat.openai.com' },
    'claude': { url: 'https://claude.ai' },
    'netflix': { url: 'https://www.netflix.com', searchTemplate: 'https://www.netflix.com/search?q=' },
    'amazon': { url: 'https://www.amazon.com', searchTemplate: 'https://www.amazon.com/s?k=' },
    'reddit': { url: 'https://www.reddit.com', searchTemplate: 'https://www.reddit.com/search/?q=' }
};
