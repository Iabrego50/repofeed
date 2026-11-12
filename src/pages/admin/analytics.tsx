import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { jsonAuthHeaders } from "@/lib/api/bearer";
import NotFound from "@/pages/NotFound.tsx";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import type { AdminAnalyticsRange, AdminAnalyticsSnapshot } from "@/lib/api/admin-analytics.ts";
import AcquisitionTab from "./_components/acquisition.tsx";
import ProductTab from "./_components/product.tsx";
import ToolsTab from "./_components/tools.tsx";
import { Segmented } from "./_components/parts.tsx";

const RANGES: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

type Tab = "acquisition" | "product" | "tools";
const TABS: Array<{ value: Tab; label: string }> = [
  { value: "acquisition", label: "Ads and acquisition" },
  { value: "product", label: "Product" },
  { value: "tools", label: "Tools" },
];

/**
 * The server decides who may see this page: /api/admin/analytics answers 404
 * unless the signed-in user has `users.is_admin`. Anything other than a
 * snapshot is rendered as the ordinary "page not found" screen.
 */
async function fetchSnapshot(range: AdminAnalyticsRange, excludeInternal: boolean): Promise<AdminAnalyticsSnapshot | "not-found"> {
  let headers: Record<string, string>;
  try {
    headers = await jsonAuthHeaders();
  } catch {
    return "not-found";
  }
  const params = new URLSearchParams({ range, excludeInternal: excludeInternal ? "1" : "0" });
  const response = await fetch(`/api/admin/analytics?${params}`, { headers });
  if (response.status === 404 || response.status === 401 || response.status === 403) return "not-found";
  if (!response.ok) throw new Error("Couldn’t load analytics");
  return (await response.json()) as AdminAnalyticsSnapshot;
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<AdminAnalyticsRange>("30d");
  const [tab, setTab] = useState<Tab>("acquisition");
  const [excludeInternal, setExcludeInternal] = useState(true);

  const query = useQuery({
    queryKey: ["admin", "analytics", range, excludeInternal],
    queryFn: () => fetchSnapshot(range, excludeInternal),
    retry: false,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const snapshot = query.data && query.data !== "not-found" ? query.data : null;
  if (query.data === "not-found") return <NotFound />;
  if (query.isError && !snapshot) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-5 text-center">
        <p className="text-sm text-muted-foreground">The numbers didn’t load. This is usually a brief database hiccup.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const rangeLabel = RANGES.find((item) => item.value === range)?.label ?? range;
  const updated = new Date(snapshot.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link to="/feed" aria-label="Back to the app" className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            <Logo withText={false} />
          </Link>
          <div className="mr-auto">
            <h1 className="text-[0.9375rem] font-semibold leading-tight">Growth</h1>
            <p className="text-xs text-muted-foreground">Only you can see this page. Updated {updated}.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="exclude-internal" checked={excludeInternal} onCheckedChange={setExcludeInternal} />
            <Label htmlFor="exclude-internal" className="text-sm font-normal text-muted-foreground">Hide my own activity</Label>
          </div>
          <Segmented value={range} onChange={setRange} options={RANGES} label="Date range" />
          <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
        <nav aria-label="Sections" className="mx-auto flex max-w-[88rem] gap-1 px-4 sm:px-6">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-current={tab === item.value ? "page" : undefined}
              onClick={() => setTab(item.value)}
              className={
                tab === item.value
                  ? "-mb-px min-h-10 cursor-pointer border-b-2 border-foreground px-2 text-sm font-semibold"
                  : "-mb-px min-h-10 cursor-pointer border-b-2 border-transparent px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[88rem] px-4 py-5 sm:px-6">
        {tab === "acquisition" && <AcquisitionTab snapshot={snapshot} />}
        {tab === "product" && <ProductTab snapshot={snapshot} rangeLabel={rangeLabel} />}
        {tab === "tools" && <ToolsTab snapshot={snapshot} />}
      </main>
    </div>
  );
}
