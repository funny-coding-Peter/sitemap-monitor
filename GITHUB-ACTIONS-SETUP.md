# GitHub Actions Sitemap 监控方案

## 🎯 方案优势

相比 Vercel + Cloudflare KV 方案：

- ✅ **完全免费** - 无需任何云服务费用
- ✅ **数据可控** - 所有快照存储在您的 Git 仓库中
- ✅ **版本管理** - 数据变更有完整的 Git 历史
- ✅ **无服务器** - 不需要维护任何基础设施
- ✅ **透明可见** - 所有运行日志都在 GitHub Actions 中

## 📋 配置步骤

### 1. 设置 GitHub Secrets

在您的 GitHub 仓库中设置飞书 Webhook：

1. 进入仓库 → `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. 添加以下 Secret：
   - **Name**: `FEISHU_WEBHOOK_URL`
   - **Value**: 您的飞书机器人 Webhook URL

#### 🤖 如何获取飞书 Webhook URL：

1. 飞书群聊 → 群设置 → 机器人 → 添加机器人
2. 选择"自定义机器人" → 设置机器人名称和头像
3. 安全设置选择"自定义关键词"，输入"sitemap"或"监控"
4. 复制生成的 Webhook URL（类似：`https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxx`）

#### ⚠️ 重要提醒：

- **只需要 `FEISHU_WEBHOOK_URL` 一个环境变量**
- **不需要** Cloudflare 相关的任何环境变量
- **不需要** 任何数据库连接信息

### 2. 确保目录结构正确

确保仓库中有以下文件：

```
.github/
  workflows/
    sitemap-monitor.yml     # ✅ 已创建
  scripts/
    monitor.js              # ✅ 已创建
public/
  site-config.json          # ✅ 已存在
data/
  snapshots/                # 自动创建
```

### 3. 测试运行

#### 手动触发测试：

1. 进入 GitHub 仓库 → `Actions` 标签
2. 选择 `Sitemap Monitor` 工作流
3. 点击 `Run workflow` → `Run workflow`
4. 查看运行结果

#### 定时执行：

- 每天北京时间 18:30 自动执行
- 可以修改 `.github/workflows/sitemap-monitor.yml` 中的 cron 时间

## 🔄 工作流程说明

### 执行流程：

```
1. GitHub Actions 定时触发
2. 读取 public/site-config.json 配置
3. 并发获取所有网站的 sitemap.xml
4. 解析 URL 列表并保存为 JSON 快照
5. 与昨日快照对比，计算差异
6. 提取新增页面的关键词
7. 发送飞书通知
8. 将新快照提交到 Git 仓库
```

### 数据存储：

- 快照文件保存在 `data/snapshots/` 目录
- 文件命名格式：`网站名_日期.json`
- 例如：`magichour_ai_2025-01-07.json`

## 📊 数据格式示例

### 快照文件格式：

```json
{
  "site": "magichour.ai",
  "date": "2025-01-07",
  "urls": [
    "https://magichour.ai/",
    "https://magichour.ai/tools/video-generator",
    "https://magichour.ai/pricing"
  ],
  "totalCount": 3,
  "timestamp": "2025-01-07T10:30:00.000Z"
}
```

### 飞书通知格式：

```
🔍 Sitemap监控 (2025/1/7)
📊 发现新增页面和关键词：

🌐 magichour.ai
📈 新增 2 个页面
🔑 关键词:
- video generator ai batch
📝 示例URL:
  • https://magichour.ai/tools/video-generator-ai
  • https://magichour.ai/features/batch-processing

📊 总计: 2 个新页面，4 个关键词
```

## 🛠️ 自定义配置

### 修改监控时间：

编辑 `.github/workflows/sitemap-monitor.yml`：

```yaml
schedule:
  # 改为每天早上 8:00 UTC (北京时间 16:00)
  - cron: "0 8 * * *"
```

### 添加监控网站：

编辑 `public/site-config.json`：

```json
{
  "existing-site": "https://existing.com/sitemap.xml",
  "new-site": "https://newsite.com/sitemap.xml"
}
```

### 修改关键词提取规则：

编辑 `.github/scripts/monitor.js` 中的 `extractKeywords` 函数

## 🐛 故障排除

### 1. Actions 权限问题

确保仓库设置中启用了 Actions 的写权限：

- 仓库 → `Settings` → `Actions` → `General`
- `Workflow permissions` → 选择 `Read and write permissions`

### 2. 飞书通知失败

- 检查 `FEISHU_WEBHOOK_URL` Secret 是否正确设置
- 确认飞书机器人 Webhook 地址有效
- 确保飞书机器人的安全关键词包含"sitemap"或"监控"

### 3. Git 提交失败

- 检查仓库是否有保护分支规则阻止自动提交
- 确认 GitHub Actions 有足够权限

### 4. 查看详细日志

- 进入 `Actions` 标签查看运行日志
- 每个步骤都有详细的输出信息

## 🚀 部署完成后的效果

1. **自动化监控**：每天定时检查所有配置的网站
2. **数据持久化**：所有历史快照保存在 Git 仓库中
3. **即时通知**：发现新内容立即通过飞书通知
4. **完全免费**：无需任何第三方服务费用
5. **数据透明**：所有数据和运行过程完全可见

## 💡 与原方案对比

| 功能     | Vercel + CloudflareKV | GitHub Actions   |
| -------- | --------------------- | ---------------- |
| 费用     | Vercel Pro + KV费用   | 完全免费         |
| 数据存储 | CloudflareKV          | Git仓库          |
| 可见性   | 需登录后台查看        | 完全透明         |
| 维护成本 | 需管理多个服务        | 零维护           |
| 数据备份 | 需手动备份            | Git自动版本控制  |
| 扩展性   | 需修改代码部署        | 直接修改文件即可 |
| 环境变量 | 需要4个变量           | 只需1个变量      |

现在您可以完全抛弃服务器，用 GitHub Actions 免费运行整个监控系统！
