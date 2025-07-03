import type { MonitoredSite, SitemapSnapshot } from "./models";

// 简单的本地文件存储方案 (仅用于开发测试)
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 读取网站配置
export function loadSites(): MonitoredSite[] {
  ensureDataDir();
  
  try {
    if (fs.existsSync(SITES_FILE)) {
      const data = fs.readFileSync(SITES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading sites:', error);
  }
  
  return [];
}

// 保存网站配置
export function saveSites(sites: MonitoredSite[]): void {
  ensureDataDir();
  
  try {
    fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2));
    console.log(`💾 Saved ${sites.length} sites to local file`);
  } catch (error) {
    console.error('Error saving sites:', error);
    throw error;
  }
}

// 添加网站
export function addSite(site: MonitoredSite): void {
  const sites = loadSites();
  sites.push(site);
  saveSites(sites);
}

// 删除网站
export function deleteSite(siteId: string): void {
  const sites = loadSites();
  const filteredSites = sites.filter(site => site.id !== siteId);
  saveSites(filteredSites);
}

// 更新网站
export function updateSite(updatedSite: MonitoredSite): void {
  const sites = loadSites();
  const index = sites.findIndex(site => site.id === updatedSite.id);
  
  if (index !== -1) {
    sites[index] = updatedSite;
    saveSites(sites);
  } else {
    throw new Error(`Site with id ${updatedSite.id} not found`);
  }
}

// 获取单个网站
export function getSite(siteId: string): MonitoredSite | null {
  const sites = loadSites();
  return sites.find(site => site.id === siteId) || null;
}