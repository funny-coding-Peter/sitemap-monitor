import { NextRequest, NextResponse } from 'next/server';
import { parseString } from "xml2js";
import { promisify } from "util";
import { getSitesConfig, saveSnapshot, loadSnapshot } from "~/lib/config";
import type { SitemapSnapshot, SitemapDiff } from "~/lib/models";
import { notifyMonitoringResults, notifyError } from "~/lib/feishu";

const parseXML = promisify(parseString);

// 获取sitemap数据 (从原sitemap router复制)
async function fetchSitemap(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const xmlText = await response.text();
    const result = await parseXML(xmlText) as any;
    
    const urls: string[] = [];
    if (result.urlset?.url) {
      for (const urlEntry of result.urlset.url) {
        if (urlEntry.loc && urlEntry.loc[0]) {
          urls.push(urlEntry.loc[0] as string);
        }
      }
    }
    
    if (result.sitemapindex?.sitemap) {
      for (const sitemapEntry of result.sitemapindex.sitemap) {
        if (sitemapEntry.loc && sitemapEntry.loc[0]) {
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

// 从URL提取关键词 (从原sitemap router复制)
function extractKeywords(urls: string[]): string[] {
  const keywords = new Set<string>();
  
  for (const url of urls) {
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      
      for (const segment of pathSegments) {
        const words = segment.split(/[-_]/).filter(word => word.length > 2);
        for (const word of words) {
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

// 计算两个快照的差异 (从原sitemap router复制)
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

// 监控单个网站
async function monitorSite(siteName: string, sitemapUrl: string): Promise<SitemapDiff | null> {
  try {
    console.log(`🔍 开始监控: ${siteName}`);
    
    // 1. 获取今日sitemap
    const urls = await fetchSitemap(sitemapUrl);
    if (urls.length === 0) {
      console.warn(`⚠️ ${siteName} sitemap为空或无法访问`);
      return null;
    }

    const today = new Date().toISOString().split('T')[0]!;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    
    // 2. 保存今日快照
    const todaySnapshot: SitemapSnapshot = {
      site: siteName,
      date: today,
      urls: urls,
      totalCount: urls.length
    };
    
    saveSnapshot(todaySnapshot);
    console.log(`💾 ${siteName} 今日快照已保存: ${urls.length} 个URL`);

    // 3. 获取昨日快照进行对比
    const yesterdaySnapshot = loadSnapshot(siteName, yesterday);
    
    if (!yesterdaySnapshot) {
      console.log(`📝 ${siteName} 无昨日快照，跳过对比`);
      return null;
    }

    // 4. 计算差异
    const diff = calculateDiff(yesterdaySnapshot, todaySnapshot);
    console.log(`📊 ${siteName} 新增 ${diff.newUrls.length} 个URL，提取 ${diff.keywords.length} 个关键词`);

    return diff;
  } catch (error) {
    console.error(`❌ 监控 ${siteName} 时出错:`, error);
    return null;
  }
}

// 主监控函数
async function runMonitoring(): Promise<void> {
  try {
    console.log("🚀 开始执行定时监控任务");
    
    // 1. 读取配置文件获取所有需要监控的网站
    const sitesConfig = getSitesConfig();
    const siteNames = Object.keys(sitesConfig);
    
    if (siteNames.length === 0) {
      console.log("📝 没有需要监控的网站");
      return;
    }

    console.log(`🎯 找到 ${siteNames.length} 个需要监控的网站: ${siteNames.join(', ')}`);

    // 2. 并发监控所有网站
    const monitorPromises = siteNames.map(siteName => 
      monitorSite(siteName, sitesConfig[siteName]!)
    );
    const results = await Promise.all(monitorPromises);
    
    // 3. 过滤出有效的diff结果
    const validDiffs = results.filter((diff): diff is SitemapDiff => 
      diff !== null && diff.newUrls.length > 0
    );

    // 4. 发送飞书通知
    if (validDiffs.length > 0 || results.length > 0) {
      await notifyMonitoringResults(validDiffs);
    }

    console.log(`✅ 监控完成: ${validDiffs.length}/${siteNames.length} 个网站有新内容`);
    
  } catch (error) {
    console.error("❌ 定时监控任务执行失败:", error);
    await notifyError(`定时监控任务执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// Vercel Cron endpoint
export async function GET(request: NextRequest) {
  console.log("🔧 定时任务API被调用");
  
  try {
    await runMonitoring();
    return NextResponse.json({ 
      success: true, 
      message: '监控任务执行成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

// 支持手动触发 (可选)
export async function POST(request: NextRequest) {
  return GET(request);
}