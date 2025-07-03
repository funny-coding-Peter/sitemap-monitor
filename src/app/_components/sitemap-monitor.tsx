"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function SitemapMonitor() {
  const [siteUrl, setSiteUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [oldDate, setOldDate] = useState("");
  const [newDate, setNewDate] = useState("");

  const fetchSnapshotMutation = api.sitemap.fetchSnapshot.useMutation();
  const compareQuery = api.sitemap.compareSnapshots.useQuery(
    {
      siteName: selectedSite,
      oldDate: oldDate,
      newDate: newDate,
    },
    {
      enabled: !!(selectedSite && oldDate && newDate),
    }
  );

  const { data: monitoredSites } = api.sitemap.getMonitoredSites.useQuery();
  const { data: snapshotDates } = api.sitemap.getSnapshotDates.useQuery(
    { siteName: selectedSite },
    { enabled: !!selectedSite }
  );

  const handleFetchSnapshot = async () => {
    if (!siteUrl) return;
    
    try {
      const result = await fetchSnapshotMutation.mutateAsync({
        siteUrl: siteUrl,
        siteName: siteName || undefined,
      });
      alert(`快照保存成功！共找到 ${result.totalCount} 个URL`);
      setSiteUrl("");
      setSiteName("");
    } catch (error) {
      alert(`错误: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div className="w-full max-w-4xl space-y-8">
      {/* 获取sitemap快照 */}
      <div className="rounded-lg bg-white/10 p-6">
        <h2 className="mb-4 text-2xl font-bold">获取Sitemap快照</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Sitemap URL</label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://wordle2.io/sitemap.xml"
              className="w-full rounded-md border border-gray-300 bg-white/20 px-3 py-2 text-white placeholder-gray-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">网站名称 (可选)</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="wordle2.io"
              className="w-full rounded-md border border-gray-300 bg-white/20 px-3 py-2 text-white placeholder-gray-300"
            />
          </div>
          <button
            onClick={handleFetchSnapshot}
            disabled={!siteUrl || fetchSnapshotMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {fetchSnapshotMutation.isPending ? "正在获取..." : "获取快照"}
          </button>
        </div>
      </div>

      {/* 快速操作按钮 */}
      <div className="rounded-lg bg-white/10 p-6">
        <h2 className="mb-4 text-2xl font-bold">快速操作</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={() => setSiteUrl("https://wordle2.io/sitemap.xml")}
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            监控 Wordle2.io
          </button>
          <button
            onClick={() => setSiteUrl("https://magichour.ai/sitemap.xml")}
            className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
          >
            监控 MagicHour.ai
          </button>
        </div>
      </div>

      {/* 比较快照 */}
      {monitoredSites && monitoredSites.length > 0 && (
        <div className="rounded-lg bg-white/10 p-6">
          <h2 className="mb-4 text-2xl font-bold">比较快照差异</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">选择网站</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white/20 px-3 py-2 text-white"
              >
                <option value="">请选择网站</option>
                {monitoredSites.map((site) => (
                  <option key={site} value={site} className="text-black">
                    {site}
                  </option>
                ))}
              </select>
            </div>

            {selectedSite && snapshotDates && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-2">旧快照日期</label>
                  <select
                    value={oldDate}
                    onChange={(e) => setOldDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white/20 px-3 py-2 text-white"
                  >
                    <option value="">请选择日期</option>
                    {snapshotDates.map((date) => (
                      <option key={date} value={date} className="text-black">
                        {date}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">新快照日期</label>
                  <select
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white/20 px-3 py-2 text-white"
                  >
                    <option value="">请选择日期</option>
                    {snapshotDates.map((date) => (
                      <option key={date} value={date} className="text-black">
                        {date}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedSite && snapshotDates && snapshotDates.length >= 2 && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (snapshotDates && snapshotDates.length >= 2) {
                      setNewDate(snapshotDates[0] || ""); // 最新
                      setOldDate(snapshotDates[1] || ""); // 次新
                    }
                  }}
                  className="rounded-md bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
                >
                  比较最近两个快照
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 显示比较结果 */}
      {compareQuery.data && (
        <div className="rounded-lg bg-white/10 p-6">
          <h2 className="mb-4 text-2xl font-bold">差异分析结果</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-green-400">
                新增URL ({compareQuery.data.newUrls.length})
              </h3>
              {compareQuery.data.newUrls.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {compareQuery.data.newUrls.slice(0, 10).map((url, idx) => (
                    <li key={idx} className="text-green-300">
                      {url}
                    </li>
                  ))}
                  {compareQuery.data.newUrls.length > 10 && (
                    <li className="text-gray-400">
                      ...还有 {compareQuery.data.newUrls.length - 10} 个
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-gray-400">无新增URL</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-red-400">
                删除URL ({compareQuery.data.removedUrls.length})
              </h3>
              {compareQuery.data.removedUrls.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {compareQuery.data.removedUrls.slice(0, 5).map((url, idx) => (
                    <li key={idx} className="text-red-300">
                      {url}
                    </li>
                  ))}
                  {compareQuery.data.removedUrls.length > 5 && (
                    <li className="text-gray-400">
                      ...还有 {compareQuery.data.removedUrls.length - 5} 个
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-gray-400">无删除URL</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-blue-400">
                提取的关键词 ({compareQuery.data.keywords.length})
              </h3>
              {compareQuery.data.keywords.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {compareQuery.data.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">无关键词</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}