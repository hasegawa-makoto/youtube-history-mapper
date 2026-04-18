export interface VideoRecord {
  id?: number;
  videoId: string;
  title: string;
  tags: string[];
  channelName: string;
  channelId: string;
  channelIconUrl: string;
  channelUrl: string;
  timestamp: number;
  watchTimeSeconds: number;
  type: 'video' | 'shorts';
  extractedKeywords: string[];
}
