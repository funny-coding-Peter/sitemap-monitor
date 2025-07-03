export interface MonitoredSite {
  id: string;
  name: string;
  sitemapUrl: string;
  isActive: boolean;
  addedAt: string;
  lastChecked?: string;
}

export interface SitemapSnapshot {
  site: string;
  date: string;
  urls: string[];
  totalCount: number;
}

export interface SitemapDiff {
  site: string;
  date: string;
  newUrls: string[];
  removedUrls: string[];
  keywords: string[];
}

export interface NotificationResult {
  success: boolean;
  message: string;
}