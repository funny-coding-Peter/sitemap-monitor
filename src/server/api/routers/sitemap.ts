import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { parseString } from "xml2js";
import { promisify } from "util";
import * as kv from "~/lib/cloudflare-kv";
import { getSitesConfig, getSnapshotDates } from "~/lib/config";
import type { SitemapSnapshot, MonitoredSite } from "~/lib/models";

const parseXML = promisify(parseString);

interface SitemapDiff {
  site: string;
  date: string;
  newUrls: string[];
  removedUrls: string[];
  keywords: string[];
}

// 获取sitemap数据
async function fetchSitemap(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const xmlText = await response.text();
    const result = await parseXML(xmlText) as any;
    
    // 处理标准sitemap格式
    const urls: string[] = [];
    if (result.urlset?.url) {
      for (const urlEntry of result.urlset.url) {
        if (urlEntry.loc && urlEntry.loc[0]) {
          urls.push(urlEntry.loc[0] as string);
        }
      }
    }
    
    // 处理sitemap索引格式
    if (result.sitemapindex?.sitemap) {
      for (const sitemapEntry of result.sitemapindex.sitemap) {
        if (sitemapEntry.loc && sitemapEntry.loc[0]) {
          // 递归获取子sitemap
          const subUrls = await fetchSitemap(sitemapEntry.loc[0] as string);
          urls.push(...subUrls);
        }
      }
    }
    
    return urls;
  } catch (error) {
    console.error(`Error fetching sitemap ${url}:`, error);
    return [];
  }
}

// KV存储操作现在通过 kv 实例处理

// 从URL提取关键词
function extractKeywords(urls: string[]): string[] {
  const keywords = new Set<string>();
  
  for (const url of urls) {
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      
      for (const segment of pathSegments) {
        // 分割连字符和下划线
        const words = segment.split(/[-_]/).filter(word => word.length > 2);
        for (const word of words) {
          // 过滤掉一些常见的无意义词汇
          if (!["www", "com", "org", "net", "api", "app", "page", "html", "htm", "php"].includes(word.toLowerCase())) {
            keywords.add(word.toLowerCase());
          }
        }
      }
    } catch (error) {
      // 忽略无效URL
    }
  }
  
  return Array.from(keywords);
}

// 计算两个快照的差异
function calculateDiff(oldSnapshot: SitemapSnapshot | null, newSnapshot: SitemapSnapshot): SitemapDiff {
  const oldUrls = new Set(oldSnapshot?.urls || []);
  const newUrls = new Set(newSnapshot.urls);
  
  const addedUrls = Array.from(newUrls).filter(url => !oldUrls.has(url));
  const removedUrls = Array.from(oldUrls).filter(url => !newUrls.has(url));
  
  const keywords = extractKeywords(addedUrls);
  
  return {
    site: newSnapshot.site,
    date: newSnapshot.date,
    newUrls: addedUrls,
    removedUrls: removedUrls,
    keywords: keywords
  };
}

export const sitemapRouter = createTRPCRouter({
  // ========== 配置管理 ==========
  
  // 获取配置文件中的网站列表
  getConfigSites: publicProcedure
    .query(() => {
      const sitesConfig = getSitesConfig();
      return Object.entries(sitesConfig).map(([name, url]) => ({
        name,
        url,
        snapshotDates: getSnapshotDates(name)
      }));
    }),

  // ========== 网站管理 ==========
  
  // 添加监控网站
  addSite: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      sitemapUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const site: MonitoredSite = {
        id: crypto.randomUUID(),
        name: input.name,
        sitemapUrl: input.sitemapUrl,
        isActive: true,
        addedAt: new Date().toISOString(),
      };
      
      await kv.saveMonitoredSite(site);
      return site;
    }),

  // 获取所有监控网站
  getSites: publicProcedure
    .query(async () => {
      return await kv.getMonitoredSitesList();
    }),

  // 删除监控网站
  deleteSite: publicProcedure
    .input(z.object({
      siteId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await kv.deleteMonitoredSite(input.siteId);
      return { success: true };
    }),

  // 更新网站状态
  updateSiteStatus: publicProcedure
    .input(z.object({
      siteId: z.string(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const site = await kv.getMonitoredSite(input.siteId);
      if (!site) {
        throw new Error("Site not found");
      }
      
      const updatedSite: MonitoredSite = {
        ...site,
        isActive: input.isActive,
      };
      
      await kv.saveMonitoredSite(updatedSite);
      return updatedSite;
    }),

  // ========== 快照操作 ==========

  // 获取sitemap快照
  fetchSnapshot: publicProcedure
    .input(z.object({
      siteUrl: z.string().url(),
      siteName: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const urls = await fetchSitemap(input.siteUrl);
      const siteName = input.siteName || new URL(input.siteUrl).hostname;
      const today = new Date().toISOString().split('T')[0];
      
      const snapshot: SitemapSnapshot = {
        site: siteName,
        date: today!,
        urls: urls,
        totalCount: urls.length
      };
      
      await kv.saveSnapshot(snapshot);
      
      return snapshot;
    }),

  // 比较两个日期的sitemap差异
  compareSnapshots: publicProcedure
    .input(z.object({
      siteName: z.string(),
      oldDate: z.string(),
      newDate: z.string()
    }))
    .query(async ({ input }) => {
      const oldSnapshot = await kv.loadSnapshot(input.siteName, input.oldDate);
      const newSnapshot = await kv.loadSnapshot(input.siteName, input.newDate);
      
      if (!newSnapshot) {
        throw new Error(`No snapshot found for ${input.siteName} on ${input.newDate}`);
      }
      
      const diff = calculateDiff(oldSnapshot, newSnapshot);
      return diff;
    }),

  // 获取监控的网站列表（兼容旧版本）
  getMonitoredSites: publicProcedure
    .query(async () => {
      return await kv.getMonitoredSites();
    }),

  // 获取网站的所有快照日期
  getSnapshotDates: publicProcedure
    .input(z.object({
      siteName: z.string()
    }))
    .query(async ({ input }) => {
      return await kv.getSnapshotDates(input.siteName);
    }),
});