import { SimpleMonitor } from "~/app/_components/simple-monitor";
import { getSitesConfig, getSnapshotDates } from "~/lib/config";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  // SSR读取配置文件
  const sitesConfigRaw = getSitesConfig();
  const sites = Object.entries(sitesConfigRaw).map(([name, url]) => ({
    name,
    url,
    snapshotDates: getSnapshotDates(name),
  }));

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto px-4 py-8">
          <SimpleMonitor sites={sites} />
        </div>
      </main>
    </HydrateClient>
  );
}
