import fs from "fs";
import path from "path";
import { parseString } from "xml2js";
import { promisify } from "util";

const parseXML = promisify(parseString);

// Force refresh - ES modules version

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
        // 跳过常见的无意义路径
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
            "index",
            "home",
          ].includes(segment.toLowerCase()) &&
          segment.length > 2
        ) {
          // 保持原始的有意义词组，只做基本清理
          const cleanSegment = segment
            .toLowerCase()
            .replace(/[^a-z0-9\-_]/g, "") // 只保留字母数字和连字符
            .replace(/^-+|-+$/g, ""); // 去掉开头结尾的连字符

          if (cleanSegment.length > 2) {
            keywords.add(cleanSegment);
          }
        }
      }
    } catch (error) {
      // 忽略无效URL
    }
  }

  return Array.from(keywords);
}

// 保存快照（包含时间戳避免覆盖）
function saveSnapshot(site, datetime, urls) {
  const dataDir = path.join(process.cwd(), "data/snapshots");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const snapshot = {
    site,
    datetime,
    urls,
    totalCount: urls.length,
    timestamp: new Date().toISOString(),
  };

  const filename = `${site.replace(/[^a-zA-Z0-9]/g, "_")}_${datetime}.json`;
  const filepath = path.join(dataDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  console.log(`💾 快照已保存: ${filename} (${urls.length} 个URL)`);

  return snapshot;
}

// 获取网站的最新快照（排除当前时间）
function getLatestSnapshot(site, excludeDateTime) {
  const dataDir = path.join(process.cwd(), "data/snapshots");
  if (!fs.existsSync(dataDir)) return null;

  try {
    const files = fs.readdirSync(dataDir);
    const sitePrefix = `${site.replace(/[^a-zA-Z0-9]/g, "_")}_`;

    const siteFiles = files
      .filter((file) => file.startsWith(sitePrefix) && file.endsWith(".json"))
      .filter((file) => !file.includes(excludeDateTime)) // 排除当前时间的文件
      .sort()
      .reverse(); // 按时间倒序

    if (siteFiles.length === 0) return null;

    const latestFile = siteFiles[0];
    const filepath = path.join(dataDir, latestFile);
    const content = fs.readFileSync(filepath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取最新快照失败:`, error);
    return null;
  }
}

// 注：旧的loadSnapshot函数已被getLatestSnapshot替代

// 计算差异
function calculateDiff(oldSnapshot, newSnapshot) {
  const oldUrls = new Set(oldSnapshot?.urls || []);
  const newUrls = new Set(newSnapshot.urls);

  const addedUrls = Array.from(newUrls).filter((url) => !oldUrls.has(url));
  const removedUrls = Array.from(oldUrls).filter((url) => !newUrls.has(url));

  const keywords = extractKeywords(addedUrls);

  return {
    site: newSnapshot.site,
    datetime: newSnapshot.datetime,
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
        message += `🔑 关键词:\n`;
        const keywordsToShow = diff.keywords.slice(0, 8);
        keywordsToShow.forEach((keyword) => {
          message += `  • ${keyword}\n`;
        });
        if (diff.keywords.length > 8) {
          message += `  • ... 还有${diff.keywords.length - 8}个关键词\n`;
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

    // 获取当前sitemap
    const urls = await fetchSitemap(sitemapUrl);
    if (urls.length === 0) {
      console.warn(`⚠️ ${siteName} sitemap为空或无法访问`);
      return null;
    }

    // 生成当前时间戳（精确到小时）
    const now = new Date();
    const currentDateTime = `${now.toISOString().split("T")[0]}_${now.getHours().toString().padStart(2, "0")}`;

    // 保存当前快照
    const currentSnapshot = saveSnapshot(siteName, currentDateTime, urls);

    // 获取最新的前一个快照进行对比
    const previousSnapshot = getLatestSnapshot(siteName, currentDateTime);

    if (!previousSnapshot) {
      console.log(`📝 ${siteName} 无历史快照，创建初始快照`);
      return {
        site: siteName,
        datetime: currentDateTime,
        newUrls: [],
        removedUrls: [],
        keywords: [],
        isInitial: true,
      };
    }

    // 计算差异
    const diff = calculateDiff(previousSnapshot, currentSnapshot);
    console.log(
      `📊 ${siteName} 新增 ${diff.newUrls.length} 个URL，提取 ${diff.keywords.length} 个关键词`,
    );

    return diff;
  } catch (error) {
    console.error(`❌ 监控 ${siteName} 时出错:`, error);
    return null;
  }
}

// 清理过时快照文件 (保留最近7天的数据)
function cleanupOldSnapshots() {
  const snapshotsDir = path.join(process.cwd(), "data/snapshots");
  if (!fs.existsSync(snapshotsDir)) return;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().split("T")[0];

  try {
    const files = fs.readdirSync(snapshotsDir);
    let deletedCount = 0;

    for (const file of files) {
      if (file.endsWith(".json")) {
        let fileDate = null;

        // 匹配新格式: site_name_YYYY-MM-DD_HH.json
        const newFormatMatch = file.match(/(\d{4}-\d{2}-\d{2})_\d{2}\.json$/);
        if (newFormatMatch) {
          fileDate = newFormatMatch[1];
        } else {
          // 匹配旧格式: site_name_YYYY-MM-DD.json
          const oldFormatMatch = file.match(/(\d{4}-\d{2}-\d{2})\.json$/);
          if (oldFormatMatch) {
            fileDate = oldFormatMatch[1];
          }
        }

        if (fileDate && fileDate < cutoffDate) {
          const filePath = path.join(snapshotsDir, file);
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ 删除过期快照: ${file}`);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ 清理完成，删除了 ${deletedCount} 个过期快照文件`);
    }
  } catch (error) {
    console.error("⚠️ 清理快照文件时出错:", error);
  }
}

// 主监控函数
async function runMonitoring() {
  try {
    console.log("🚀 开始执行 GitHub Actions 监控任务");

    // 首先清理过时文件
    cleanupOldSnapshots();

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

    // 过滤出有效的diff结果（排除初始快照）
    const validDiffs = results.filter(
      (diff) => diff !== null && diff.newUrls.length > 0 && !diff.isInitial,
    );

    // 统计初始快照
    const initialSnapshots = results.filter(
      (result) => result !== null && result.isInitial,
    );

    // 发送飞书通知
    if (validDiffs.length > 0) {
      await sendFeishuNotification(validDiffs);
    } else if (initialSnapshots.length > 0) {
      // 发送初始快照通知
      const message = `🔍 Sitemap监控初始化完成\n📊 已为 ${initialSnapshots.length} 个网站创建快照，下次执行将开始监控变化`;
      await sendMessage(process.env.FEISHU_WEBHOOK_URL, message);
    }

    console.log(
      `✅ 监控完成: ${validDiffs.length}/${siteNames.length} 个网站有新内容, ${initialSnapshots.length} 个网站创建初始快照`,
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
