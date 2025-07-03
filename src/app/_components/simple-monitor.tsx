interface ConfigSite {
  name: string;
  url: string;
  snapshotDates: string[];
}

interface SimpleMonitorProps {
  sites: ConfigSite[];
}

export function SimpleMonitor({ sites }: SimpleMonitorProps) {

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold">Sitemap 监控系统</h1>
        <p className="text-gray-300 mt-2">
          自动监控配置网站的sitemap变化，每天凌晨4点执行
        </p>
      </div>

      {/* 配置状态 */}
      <div className="bg-white/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">监控配置</h2>
        
        {sites.length > 0 ? (
          <div className="space-y-3">
            <p className="text-green-400">✅ 配置已加载，共 {sites.length} 个网站</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sites.map((site) => (
                <div key={site.name} className="bg-white/5 rounded-lg p-4">
                  <h3 className="font-medium text-lg">{site.name}</h3>
                  <p className="text-sm text-gray-300 font-mono mb-2">
                    {site.url}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="inline-block px-2 py-1 text-xs bg-green-600 text-white rounded-full">
                      🟢 活跃监控
                    </span>
                    <span className="text-xs text-gray-400">
                      {site.snapshotDates.length} 个快照
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-orange-400 text-lg">⚠️ 未找到配置文件</p>
            <p className="text-gray-400 text-sm mt-2">
              请在 public/sites-config.json 中配置需要监控的网站
            </p>
          </div>
        )}
      </div>

      {/* 系统状态 */}
      <div className="bg-white/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">系统状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">⏰</div>
            <div className="font-medium">定时任务</div>
            <div className="text-sm text-gray-300">每天 04:00 执行</div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">📱</div>
            <div className="font-medium">飞书通知</div>
            <div className="text-sm text-green-300">已配置</div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💾</div>
            <div className="font-medium">数据存储</div>
            <div className="text-sm text-gray-300">本地文件</div>
          </div>
        </div>
      </div>

      {/* 说明信息 */}
      <div className="bg-white/5 rounded-lg p-4">
        <h3 className="font-semibold mb-2">📝 配置方法</h3>
        <div className="text-sm text-gray-300 space-y-2">
          <p>1. 编辑 <code className="bg-white/10 px-1 rounded">public/sites-config.json</code> 文件</p>
          <p>2. 格式：<code className="bg-white/10 px-1 rounded">{"{"}"网站名": "sitemap网址"{"}"}</code></p>
          <p>3. 保存后刷新页面即可看到更新</p>
          <p>4. 系统每天会自动检查并通过飞书通知新发现的关键词</p>
        </div>
      </div>
    </div>
  );
}