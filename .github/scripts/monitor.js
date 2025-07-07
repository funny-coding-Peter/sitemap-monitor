import fs from "fs";
import path from "path";
import { parseString } from "xml2js";
import { promisify } from "util";

const parseXML = promisify(parseString);

// 读取网站配置
function getSitesConfig() {
  const configPath = path.join(process.cwd(), "public/site-config.json");
  try {
    const content = fs.readFileSync(configPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("❌ 无法读取配置文件:", error);
    return {};
  }
}

// 获取sitemap数据
async function fetchSitemap(url) {
  try {
    console.log(`🔍 正在获取 sitemap: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const xmlText = await response.text();
    const result = await parseXML(xmlText);

    const urls = [];
    if (result.urlset?.url) {
      for (const urlEntry of result.urlset.url) {
        if (urlEntry.loc && urlEntry.loc[0]) {
          urls.push(urlEntry.loc[0]);
        }
      }
    }

    // 处理 sitemap index
    if (result.sitemapindex?.sitemap) {
      for (const sitemapEntry of result.sitemapindex.sitemap) {
        if (sitemapEntry.loc && sitemapEntry.loc[0]) {
          const subUrls = await fetchSitemap(sitemapEntry.loc[0]);
          urls.push(...subUrls);
        }
      }
    }

    return urls;
  } catch (error) {
    console.error(`❌ 获取 sitemap 失败 ${url}:`, error);
    return [];
  }
}

// 从URL提取关键词
function extractKeywords(urls) {
  const keywords = new Set();

  for (const url of urls) {
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

      for (const segment of pathSegments) {
        const words = segment.split(/[-_]/).filter((word) => word.length > 2);
        for (const word of words) {
          if (
            ![
              "www",
              "com",
              "org",
              "net",
              "api",
              "app",
              "page",
              "html",
              "htm",
              "php",
            ].includes(word.toLowerCase())
          ) {
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

// 保存快照
function saveSnapshot(site, date, urls) {
  const dataDir = path.join(process.cwd(), "data/snapshots");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const snapshot = {
    site,
    date,
    urls,
    totalCount: urls.length,
    timestamp: new Date().toISOString(),
  };

  const filename = `${site.replace(/[^a-zA-Z0-9]/g, "_")}_${date}.json`;
  const filepath = path.join(dataDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  console.log(`💾 快照已保存: ${filename} (${urls.length} 个URL)`);

  return snapshot;
}

// 读取快照
function loadSnapshot(site, date) {
  const filename = `${site.replace(/[^a-zA-Z0-9]/g, "_")}_${date}.json`;
  const filepath = path.join(process.cwd(), "data/snapshots", filename);

  try {
    const content = fs.readFileSync(filepath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// 计算差异
function calculateDiff(oldSnapshot, newSnapshot) {
  const oldUrls = new Set(oldSnapshot?.urls || []);
  const newUrls = new Set(newSnapshot.urls);

  const addedUrls = Array.from(newUrls).filter((url) => !oldUrls.has(url));
  const removedUrls = Array.from(oldUrls).filter((url) => !newUrls.has(url));

  const keywords = extractKeywords(addedUrls);

  return {
    site: newSnapshot.site,
    date: newSnapshot.date,
    newUrls: addedUrls,
    removedUrls: removedUrls,
    keywords: keywords,
  };
}

// 发送飞书通知
async function sendFeishuNotification(diffs) {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("⚠️ 未配置飞书 Webhook URL，跳过通知");
    return;
  }

  const today = new Date().toLocaleDateString("zh-CN");

  if (diffs.length === 0 || diffs.every((diff) => diff.newUrls.length === 0)) {
    const message = `🔍 Sitemap监控 (${today})\n📊 今日无新增页面`;
    await sendMessage(webhookUrl, message);
    return;
  }

  let message = `🔍 Sitemap监控 (${today})\n📊 发现新增页面和关键词：\n\n`;

  let totalNewUrls = 0;
  const allKeywords = new Set();

  for (const diff of diffs) {
    if (diff.newUrls.length > 0) {
      totalNewUrls += diff.newUrls.length;
      diff.keywords.forEach((keyword) => allKeywords.add(keyword));

      message += `🌐 ${diff.site}\n`;
      message += `📈 新增 ${diff.newUrls.length} 个页面\n`;

      if (diff.keywords.length > 0) {
        message += `🔑 关键词: \n`;
        const keywordsToShow = diff.keywords.slice(0, 10);
        message += `- ${keywordsToShow.join(" ")}\n`;
        if (diff.keywords.length > 10) {
          message += `- ... 还有${diff.keywords.length - 10}个关键词\n`;
        }
      }

      // 显示前3个新URL作为示例
      if (diff.newUrls.length > 0) {
        message += `📝 示例URL:\n`;
        const examples = diff.newUrls.slice(0, 3);
        for (const url of examples) {
          message += `  • ${url}\n`;
        }
        if (diff.newUrls.length > 3) {
          message += `  • ... 还有${diff.newUrls.length - 3}个\n`;
        }
      }

      message += "\n";
    }
  }

  message += `📊 总计: ${totalNewUrls} 个新页面，${allKeywords.size} 个关键词`;

  await sendMessage(webhookUrl, message);
}

async function sendMessage(webhookUrl, message) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text: message,
        },
      }),
    });

    if (response.ok) {
      console.log("✅ 飞书通知发送成功");
    } else {
      console.error("❌ 飞书通知发送失败:", response.statusText);
    }
  } catch (error) {
    console.error("❌ 发送飞书通知时出错:", error);
  }
}

// 监控单个网站
async function monitorSite(siteName, sitemapUrl) {
  try {
    console.log(`🔍 开始监控: ${siteName}`);

    // 获取今日sitemap
    const urls = await fetchSitemap(sitemapUrl);
    if (urls.length === 0) {
      console.warn(`⚠️ ${siteName} sitemap为空或无法访问`);
      return null;
    }

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // 保存今日快照
    const todaySnapshot = saveSnapshot(siteName, today, urls);

    // 获取昨日快照进行对比
    const yesterdaySnapshot = loadSnapshot(siteName, yesterday);

    if (!yesterdaySnapshot) {
      console.log(`📝 ${siteName} 无昨日快照，跳过对比`);
      return null;
    }

    // 计算差异
    const diff = calculateDiff(yesterdaySnapshot, todaySnapshot);
    console.log(
      `📊 ${siteName} 新增 ${diff.newUrls.length} 个URL，提取 ${diff.keywords.length} 个关键词`,
    );

    return diff;
  } catch (error) {
    console.error(`❌ 监控 ${siteName} 时出错:`, error);
    return null;
  }
}

// 主监控函数
async function runMonitoring() {
  try {
    console.log("🚀 开始执行 GitHub Actions 监控任务");

    // 读取配置文件获取所有需要监控的网站
    const sitesConfig = getSitesConfig();
    const siteNames = Object.keys(sitesConfig);

    if (siteNames.length === 0) {
      console.log("📝 没有需要监控的网站");
      return;
    }

    console.log(
      `🎯 找到 ${siteNames.length} 个需要监控的网站: ${siteNames.join(", ")}`,
    );

    // 并发监控所有网站
    const monitorPromises = siteNames.map((siteName) =>
      monitorSite(siteName, sitesConfig[siteName]),
    );
    const results = await Promise.all(monitorPromises);

    // 过滤出有效的diff结果
    const validDiffs = results.filter(
      (diff) => diff !== null && diff.newUrls.length > 0,
    );

    // 发送飞书通知
    if (validDiffs.length > 0 || results.length > 0) {
      await sendFeishuNotification(validDiffs);
    }

    console.log(
      `✅ 监控完成: ${validDiffs.length}/${siteNames.length} 个网站有新内容`,
    );
  } catch (error) {
    console.error("❌ 监控任务执行失败:", error);
    // 发送错误通知
    if (process.env.FEISHU_WEBHOOK_URL) {
      await sendMessage(
        process.env.FEISHU_WEBHOOK_URL,
        `❌ GitHub Actions 监控任务失败: ${error.message}`,
      );
    }
  }
}

// 执行监控
runMonitoring();
