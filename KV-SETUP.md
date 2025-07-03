# Cloudflare KV 配置指南

## 1. 创建 Cloudflare KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择你的域名 (如果没有可以创建一个)
3. 在左侧菜单中点击 **Workers & Pages**
4. 点击 **KV**
5. 点击 **Create namespace**
6. 输入命名空间名称：`sitemap-monitor`
7. 点击 **Add**

## 2. 获取配置信息

### Account ID
- 在 Cloudflare Dashboard 右侧栏可以看到你的 **Account ID**

### API Token
1. 点击右上角头像 → **My Profile**
2. 选择 **API Tokens** 标签
3. 点击 **Create Token**
4. 选择 **Custom token**
5. 设置权限：
   - **Account** - `Cloudflare Workers:Edit`
   - **Zone Resources** - `Include All zones`
6. 点击 **Continue to summary** → **Create Token**
7. 复制生成的 token

### Namespace ID
- 回到 KV 页面
- 找到刚创建的 `sitemap-monitor` 命名空间
- 点击它，在 URL 中可以看到 namespace ID

## 3. 配置环境变量

创建 `.env` 文件：

```bash
# 复制 .env.example
cp .env.example .env
```

编辑 `.env` 文件：

```bash
CLOUDFLARE_ACCOUNT_ID=你的_account_id
CLOUDFLARE_API_TOKEN=你的_api_token
CLOUDFLARE_KV_NAMESPACE_ID=你的_namespace_id
```

## 4. 测试功能

1. 启动开发服务器：
```bash
pnpm dev
```

2. 打开 http://localhost:3000

3. 测试功能：
   - 点击 "监控 Wordle2.io" 按钮
   - 等待快照获取完成
   - 再次获取快照并比较差异

## 5. 降级方案

如果没有配置 Cloudflare KV，系统会自动使用内存存储作为降级方案，不会影响开发和测试。

## 6. 生产部署

部署到 Vercel 时，在 Vercel Dashboard 中设置环境变量：
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` 
- `CLOUDFLARE_KV_NAMESPACE_ID`

## 7. 费用说明

Cloudflare KV 免费额度：
- **读取操作**: 每天 100,000 次
- **写入操作**: 每天 1,000 次
- **存储空间**: 1GB

对于sitemap监控应用，这个额度完全够用。