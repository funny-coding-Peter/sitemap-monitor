import { env } from "~/env";
import type { MonitoredSite, SitemapSnapshot } from "./models";

interface CloudflareKVResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result?: any;
}

// 配置检查
function isKVConfigured(): boolean {
  return !!(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_KV_NAMESPACE_ID);
}

// 生成KV请求URL
function getKVUrl(endpoint: string): string {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.CLOUDFLARE_KV_NAMESPACE_ID}`;
  return `${baseUrl}${endpoint}`;
}

// KV请求封装
async function makeKVRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  if (!isKVConfigured()) {
    throw new Error("Cloudflare KV not configured");
  }

  const url = getKVUrl(endpoint);
  const headers = {
    'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

// 生成KV键名
function generateSnapshotKey(site: string, date: string): string {
  const safeSiteName = site.replace(/[^a-zA-Z0-9]/g, "_");
  return `sitemap:${safeSiteName}:${date}`;
}

function generateSiteKey(siteId: string): string {
  return `sites:${siteId}`;
}

// ========== 降级存储 ==========
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 内存缓存 (提高性能)
const fallbackSnapshots = new Map<string, SitemapSnapshot>();
const fallbackSites = new Map<string, MonitoredSite>();
let sitesLoaded = false;
let snapshotsLoaded = false;

// ========== Sitemap快照操作 ==========

export async function saveSnapshot(snapshot: SitemapSnapshot): Promise<void> {
  if (!isKVConfigured()) {
    const key = generateSnapshotKey(snapshot.site, snapshot.date);
    fallbackSnapshots.set(key, snapshot);
    console.log(`💾 Snapshot saved to memory: ${key}`);
    return;
  }

  try {
    const key = generateSnapshotKey(snapshot.site, snapshot.date);
    const response = await makeKVRequest(`/values/${key}`, {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save snapshot: ${error}`);
    }

    console.log(`✅ Snapshot saved to KV: ${key}`);
  } catch (error) {
    console.error("Error saving to KV, using fallback:", error);
    const key = generateSnapshotKey(snapshot.site, snapshot.date);
    fallbackSnapshots.set(key, snapshot);
  }
}

export async function loadSnapshot(site: string, date: string): Promise<SitemapSnapshot | null> {
  if (!isKVConfigured()) {
    const key = generateSnapshotKey(site, date);
    const data = fallbackSnapshots.get(key) || null;
    if (data) console.log(`📖 Snapshot loaded from memory: ${key}`);
    return data;
  }

  try {
    const key = generateSnapshotKey(site, date);
    const response = await makeKVRequest(`/values/${key}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to load snapshot: ${error}`);
    }

    const data = await response.json() as SitemapSnapshot;
    console.log(`📖 Snapshot loaded from KV: ${key}`);
    return data;
  } catch (error) {
    console.error("Error loading from KV, using fallback:", error);
    const key = generateSnapshotKey(site, date);
    return fallbackSnapshots.get(key) || null;
  }
}

export async function getMonitoredSites(): Promise<string[]> {
  if (!isKVConfigured()) {
    const sites = new Set<string>();
    for (const key of fallbackSnapshots.keys()) {
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'sitemap') {
        sites.add(parts[1]!);
      }
    }
    return Array.from(sites);
  }

  try {
    const response = await makeKVRequest('/keys?prefix=sitemap:');
    
    if (!response.ok) {
      throw new Error(`Failed to list keys: ${response.statusText}`);
    }

    const result: CloudflareKVResponse = await response.json();
    if (!result.success || !result.result) {
      throw new Error("Invalid response from KV");
    }

    const sites = new Set<string>();
    for (const keyData of result.result) {
      const key = keyData.name;
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'sitemap') {
        sites.add(parts[1]!);
      }
    }

    return Array.from(sites);
  } catch (error) {
    console.error("Error getting monitored sites from KV, using fallback:", error);
    const sites = new Set<string>();
    for (const key of fallbackSnapshots.keys()) {
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'sitemap') {
        sites.add(parts[1]!);
      }
    }
    return Array.from(sites);
  }
}

export async function getSnapshotDates(siteName: string): Promise<string[]> {
  if (!isKVConfigured()) {
    const safeSiteName = siteName.replace(/[^a-zA-Z0-9]/g, "_");
    const dates: string[] = [];
    
    for (const key of fallbackSnapshots.keys()) {
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'sitemap' && parts[1] === safeSiteName) {
        dates.push(parts[2]!);
      }
    }
    
    return dates.sort().reverse();
  }

  try {
    const safeSiteName = siteName.replace(/[^a-zA-Z0-9]/g, "_");
    const prefix = `sitemap:${safeSiteName}:`;
    const response = await makeKVRequest(`/keys?prefix=${encodeURIComponent(prefix)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to list keys: ${response.statusText}`);
    }

    const result: CloudflareKVResponse = await response.json();
    if (!result.success || !result.result) {
      throw new Error("Invalid response from KV");
    }

    const dates: string[] = [];
    for (const keyData of result.result) {
      const key = keyData.name;
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'sitemap' && parts[1] === safeSiteName) {
        dates.push(parts[2]!);
      }
    }

    return dates.sort().reverse();
  } catch (error) {
    console.error("Error getting snapshot dates from KV, using fallback:", error);
    const safeSiteName = siteName.replace(/[^a-zA-Z0-9]/g, "_");
    const dates: string[] = [];
    
    for (const key of fallbackSnapshots.keys()) {
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'sitemap' && parts[1] === safeSiteName) {
        dates.push(parts[2]!);
      }
    }
    
    return dates.sort().reverse();
  }
}

// ========== 网站管理操作 ==========

export async function saveMonitoredSite(site: MonitoredSite): Promise<void> {
  if (!isKVConfigured()) {
    fallbackSites.set(site.id, site);
    console.log(`💾 Site saved to memory: ${site.name}`);
    return;
  }

  try {
    const key = generateSiteKey(site.id);
    const response = await makeKVRequest(`/values/${key}`, {
      method: 'PUT',
      body: JSON.stringify(site),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save site: ${error}`);
    }

    console.log(`✅ Site saved to KV: ${site.name}`);
  } catch (error) {
    console.error("Error saving site to KV, using fallback:", error);
    fallbackSites.set(site.id, site);
  }
}

export async function getMonitoredSitesList(): Promise<MonitoredSite[]> {
  if (!isKVConfigured()) {
    return Array.from(fallbackSites.values());
  }

  try {
    const response = await makeKVRequest('/keys?prefix=sites:');
    
    if (!response.ok) {
      throw new Error(`Failed to list site keys: ${response.statusText}`);
    }

    const result: CloudflareKVResponse = await response.json();
    if (!result.success || !result.result) {
      throw new Error("Invalid response from KV");
    }

    const sites: MonitoredSite[] = [];
    for (const keyData of result.result) {
      const key = keyData.name;
      try {
        const siteResponse = await makeKVRequest(`/values/${key}`);
        if (siteResponse.ok) {
          const site = await siteResponse.json() as MonitoredSite;
          sites.push(site);
        }
      } catch (error) {
        console.error(`Error loading site ${key}:`, error);
      }
    }

    return sites.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error getting sites from KV, using fallback:", error);
    return Array.from(fallbackSites.values());
  }
}

export async function deleteMonitoredSite(siteId: string): Promise<void> {
  if (!isKVConfigured()) {
    fallbackSites.delete(siteId);
    console.log(`🗑️ Site deleted from memory: ${siteId}`);
    return;
  }

  try {
    const key = generateSiteKey(siteId);
    const response = await makeKVRequest(`/values/${key}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete site: ${error}`);
    }

    console.log(`🗑️ Site deleted from KV: ${siteId}`);
  } catch (error) {
    console.error("Error deleting site from KV, using fallback:", error);
    fallbackSites.delete(siteId);
  }
}

export async function getMonitoredSite(siteId: string): Promise<MonitoredSite | null> {
  if (!isKVConfigured()) {
    return fallbackSites.get(siteId) || null;
  }

  try {
    const key = generateSiteKey(siteId);
    const response = await makeKVRequest(`/values/${key}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to load site: ${error}`);
    }

    return await response.json() as MonitoredSite;
  } catch (error) {
    console.error("Error loading site from KV, using fallback:", error);
    return fallbackSites.get(siteId) || null;
  }
}