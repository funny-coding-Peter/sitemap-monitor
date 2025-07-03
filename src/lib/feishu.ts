import { env } from "~/env";
import type { SitemapDiff } from "./models";

interface FeishuMessage {
  msg_type: "text" | "rich_text";
  content: {
    text?: string;
    rich_text?: any;
  };
}

// 发送飞书消息
export async function sendFeishuNotification(message: string): Promise<boolean> {
  if (!env.FEISHU_WEBHOOK_URL) {
    console.warn("飞书webhook未配置，跳过通知");
    return false;
  }

  try {
    const feishuMessage: FeishuMessage = {
      msg_type: "text",
      content: {
        text: message
      }
    };

    const response = await fetch(env.FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feishuMessage),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("飞书通知失败:", error);
      return false;
    }

    const result = await response.json();
    if (result.StatusCode !== 0) {
      console.error("飞书通知返回错误:", result);
      return false;
    }

    console.log("✅ 飞书通知发送成功");
    return true;
  } catch (error) {
    console.error("发送飞书通知时出错:", error);
    return false;
  }
}

// 格式化sitemap差异为飞书消息
export function formatSitemapDiffMessage(diffs: SitemapDiff[]): string {
  const today = new Date().toLocaleDateString('zh-CN');
  
  if (diffs.length === 0 || diffs.every(diff => diff.newUrls.length === 0)) {
    return `🔍 Sitemap监控 (${today})\n📊 今日无新增页面`;
  }

  let message = `🔍 Sitemap监控 (${today})\n📊 发现新增页面和关键词：\n\n`;

  let totalNewUrls = 0;
  let totalKeywords = 0;

  for (const diff of diffs) {
    if (diff.newUrls.length > 0) {
      totalNewUrls += diff.newUrls.length;
      totalKeywords += diff.keywords.length;

      message += `🌐 ${diff.site}\n`;
      message += `📈 新增 ${diff.newUrls.length} 个页面\n`;
      
      if (diff.keywords.length > 0) {
        message += `🔑 关键词: ${diff.keywords.slice(0, 10).join(', ')}`;
        if (diff.keywords.length > 10) {
          message += ` (+${diff.keywords.length - 10}个)`;
        }
        message += '\n';
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
      
      message += '\n';
    }
  }

  message += `📊 总计: ${totalNewUrls} 个新页面，${totalKeywords} 个关键词`;
  
  return message;
}

// 发送监控结果通知
export async function notifyMonitoringResults(diffs: SitemapDiff[]): Promise<boolean> {
  const message = formatSitemapDiffMessage(diffs);
  return await sendFeishuNotification(message);
}

// 发送错误通知
export async function notifyError(error: string): Promise<boolean> {
  const message = `❌ Sitemap监控出错\n📅 ${new Date().toLocaleString('zh-CN')}\n❗ ${error}`;
  return await sendFeishuNotification(message);
}