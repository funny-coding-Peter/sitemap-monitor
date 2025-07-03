import fs from 'fs';
import path from 'path';
import type { SitemapSnapshot } from './models';

const CONFIG_FILE = path.join(process.cwd(), 'public', 'site-config.json');
const SNAPSHOTS_DIR = path.join(process.cwd(), 'data', 'snapshots');

// 确保目录存在
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 读取网站配置
export function getSitesConfig(): Record<string, string> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading sites config:', error);
  }
  
  return {};
}

// 保存快照
export function saveSnapshot(snapshot: SitemapSnapshot): void {
  ensureDir(SNAPSHOTS_DIR);
  
  const filename = `${snapshot.site}_${snapshot.date}.json`;
  const filepath = path.join(SNAPSHOTS_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    console.log(`💾 Snapshot saved: ${filename}`);
  } catch (error) {
    console.error(`Error saving snapshot ${filename}:`, error);
    throw error;
  }
}

// 读取快照
export function loadSnapshot(site: string, date: string): SitemapSnapshot | null {
  const filename = `${site}_${date}.json`;
  const filepath = path.join(SNAPSHOTS_DIR, filename);
  
  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf-8');
      const snapshot = JSON.parse(data) as SitemapSnapshot;
      console.log(`📖 Snapshot loaded: ${filename}`);
      return snapshot;
    }
  } catch (error) {
    console.error(`Error loading snapshot ${filename}:`, error);
  }
  
  return null;
}

// 获取网站的所有快照日期
export function getSnapshotDates(site: string): string[] {
  ensureDir(SNAPSHOTS_DIR);
  
  try {
    const files = fs.readdirSync(SNAPSHOTS_DIR);
    const dates: string[] = [];
    
    const prefix = `${site}_`;
    const suffix = '.json';
    
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith(suffix)) {
        const date = file.slice(prefix.length, -suffix.length);
        dates.push(date);
      }
    }
    
    return dates.sort().reverse(); // 最新的在前面
  } catch (error) {
    console.error(`Error getting snapshot dates for ${site}:`, error);
    return [];
  }
}