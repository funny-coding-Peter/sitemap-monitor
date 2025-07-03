"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import type { MonitoredSite } from "~/lib/models";

export function SiteManager() {
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [isAddingMode, setIsAddingMode] = useState(false);

  // tRPC queries and mutations
  const { data: sites, refetch: refetchSites } = api.sitemap.getSites.useQuery();
  const addSiteMutation = api.sitemap.addSite.useMutation();
  const deleteSiteMutation = api.sitemap.deleteSite.useMutation();
  const updateStatusMutation = api.sitemap.updateSiteStatus.useMutation();

  // 手动触发监控测试
  const [isTestingMonitor, setIsTestingMonitor] = useState(false);
  const testMonitor = async () => {
    setIsTestingMonitor(true);
    try {
      const response = await fetch('/api/cron/monitor', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        alert("✅ 监控测试成功！请查看飞书通知");
      } else {
        alert(`❌ 监控测试失败: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ 测试请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsTestingMonitor(false);
    }
  };

  const handleAddSite = async () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      alert("请填写完整的网站名称和Sitemap URL");
      return;
    }

    try {
      await addSiteMutation.mutateAsync({
        name: newSiteName.trim(),
        sitemapUrl: newSiteUrl.trim(),
      });
      
      setNewSiteName("");
      setNewSiteUrl("");
      setIsAddingMode(false);
      refetchSites();
      alert("✅ 网站添加成功！");
    } catch (error) {
      alert(`❌ 添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (!confirm(`确定要删除网站 "${siteName}" 吗？此操作无法撤销。`)) {
      return;
    }

    try {
      await deleteSiteMutation.mutateAsync({ siteId });
      refetchSites();
      alert("🗑️ 网站删除成功！");
    } catch (error) {
      alert(`❌ 删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleToggleStatus = async (site: MonitoredSite) => {
    try {
      await updateStatusMutation.mutateAsync({
        siteId: site.id,
        isActive: !site.isActive,
      });
      refetchSites();
    } catch (error) {
      alert(`❌ 状态更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '从未';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* 标题和操作区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sitemap 监控管理</h1>
          <p className="text-gray-300 mt-2">
            管理需要监控的网站，系统将每天自动检查sitemap变化并通过飞书通知
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={testMonitor}
            disabled={isTestingMonitor}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isTestingMonitor ? "测试中..." : "🧪 测试监控"}
          </button>
          <button
            onClick={() => setIsAddingMode(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            ➕ 添加网站
          </button>
        </div>
      </div>

      {/* 添加网站表单 */}
      {isAddingMode && (
        <div className="bg-white/10 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">添加新的监控网站</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">网站名称</label>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="例如: Wordle2.io"
                className="w-full px-3 py-2 bg-white/20 border border-gray-300 rounded-md text-white placeholder-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sitemap URL</label>
              <input
                type="url"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                placeholder="https://wordle2.io/sitemap.xml"
                className="w-full px-3 py-2 bg-white/20 border border-gray-300 rounded-md text-white placeholder-gray-300"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAddSite}
              disabled={addSiteMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {addSiteMutation.isPending ? "添加中..." : "✅ 确认添加"}
            </button>
            <button
              onClick={() => {
                setIsAddingMode(false);
                setNewSiteName("");
                setNewSiteUrl("");
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ❌ 取消
            </button>
          </div>
        </div>
      )}

      {/* 网站列表 */}
      <div className="bg-white/10 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/20">
          <h2 className="text-xl font-semibold">监控网站列表</h2>
          <p className="text-sm text-gray-300 mt-1">
            {sites ? `共 ${sites.length} 个网站，${sites.filter(s => s.isActive).length} 个活跃` : '加载中...'}
          </p>
        </div>

        {sites ? (
          sites.length > 0 ? (
            <div className="divide-y divide-white/20">
              {sites.map((site) => (
                <div key={site.id} className="px-6 py-4 hover:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-medium">{site.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          site.isActive 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-600 text-gray-300'
                        }`}>
                          {site.isActive ? '🟢 活跃' : '⭕ 暂停'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        <p>📍 URL: <span className="font-mono">{site.sitemapUrl}</span></p>
                        <p>📅 添加时间: {formatDate(site.addedAt)}</p>
                        <p>🔍 最后检查: {formatDate(site.lastChecked)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(site)}
                        disabled={updateStatusMutation.isPending}
                        className={`px-3 py-1 text-sm rounded-md ${
                          site.isActive
                            ? 'bg-orange-600 hover:bg-orange-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        } disabled:opacity-50`}
                      >
                        {site.isActive ? '⏸️ 暂停' : '▶️ 启用'}
                      </button>
                      
                      <button
                        onClick={() => handleDeleteSite(site.id, site.name)}
                        disabled={deleteSiteMutation.isPending}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-400 text-lg">暂无监控网站</p>
              <p className="text-gray-500 text-sm mt-2">点击"添加网站"按钮开始监控</p>
            </div>
          )
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-400">加载中...</p>
          </div>
        )}
      </div>

      {/* 说明信息 */}
      <div className="bg-white/5 rounded-lg p-4">
        <h3 className="font-semibold mb-2">📝 使用说明</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• 系统每天凌晨4点自动监控所有活跃网站</li>
          <li>• 发现新页面和关键词时会通过飞书机器人通知</li>
          <li>• 可以手动点击"测试监控"按钮立即执行一次检查</li>
          <li>• 暂停的网站不会被监控，但历史数据会保留</li>
        </ul>
      </div>
    </div>
  );
}