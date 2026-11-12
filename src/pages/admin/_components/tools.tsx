import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select.tsx";
import { jsonAuthHeaders } from "@/lib/api/bearer";
import { downloadCsv, toCsv } from "@/lib/csv.ts";
import { SITE_URL } from "@/lib/site.ts";
import type { AdminAnalyticsSnapshot } from "@/lib/api/admin-analytics.ts";
import { DEFAULT_VARIANT, LANDING_VARIANTS } from "@/pages/landing/variants.ts";
import { money } from "../_lib/format.ts";
import { Panel, TD, TH } from "./parts.tsx";

const PLATFORMS = [
  { id: "google", label: "Google Ads", source: "google", medium: "cpc" },
  { id: "linkedin", label: "LinkedIn Ads", source: "linkedin", medium: "paid_social" },
  { id: "meta", label: "Meta Ads", source: "meta", medium: "paid_social" },
  { id: "reddit", label: "Reddit Ads", source: "reddit", medium: "paid_social" },
  { id: "newsletter", label: "Newsletter or email", source: "newsletter", medium: "email" },
] as const;

/** Lowercase, dash-separated tags keep one campaign from splitting into several rows. */
function tag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_.+-]/g, "");
}

function LinkBuilder() {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["id"]>("google");
  const [slug, setSlug] = useState(LANDING_VARIANTS[0].slug);
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const chosen = PLATFORMS.find((p) => p.id === platform)!;

  const url = useMemo(() => {
    const target = new URL(slug ? `/for/${slug}` : "/", SITE_URL);
    target.searchParams.set("utm_source", chosen.source);
    target.searchParams.set("utm_medium", chosen.medium);
    if (tag(campaign)) target.searchParams.set("utm_campaign", tag(campaign));
    if (tag(content)) target.searchParams.set("utm_content", tag(content));
    if (tag(term)) target.searchParams.set("utm_term", tag(term));
    return target.toString();
  }, [slug, chosen, campaign, content, term]);

  const copy = async () => {
    if (!tag(campaign)) {
      toast.error("Name the campaign first, so its visits land on one row.");
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Panel title="Build a tagged ad link" hint="Use this as the destination URL in the ad. The page headline will match the ad group, and the visit shows up under this campaign.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lb-platform">Where the ad runs</Label>
          <NativeSelect id="lb-platform" value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="w-full">
            {PLATFORMS.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-page">Landing page</Label>
          <NativeSelect id="lb-page" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full">
            {[DEFAULT_VARIANT, ...LANDING_VARIANTS].map((v) => (
              <NativeSelectOption key={v.slug || "home"} value={v.slug}>{v.slug ? `/for/${v.slug}` : "/ (home)"}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-campaign">Campaign name</Label>
          <Input id="lb-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="repository-search-us" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-content">Ad or creative <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="lb-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="headline-b" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="lb-term">Keyword <span className="font-normal text-muted-foreground">(optional, search ads)</span></Label>
          <Input id="lb-term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="research repository tool" />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Page headline: <span className="text-foreground">{(LANDING_VARIANTS.find((v) => v.slug === slug) ?? DEFAULT_VARIANT).headline}</span>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <output className="min-w-0 flex-1 break-all rounded-md border border-border bg-background px-3 py-2 text-sm">{url}</output>
        <Button type="button" onClick={() => void copy()} className="shrink-0">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </Panel>
  );
}

function SpendLedger({ snapshot }: { snapshot: AdminAnalyticsSnapshot }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ periodStart: today, periodEnd: today, source: "google", campaign: "", amount: "", note: "" });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });

  const add = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/ad-spend", {
        method: "POST",
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({ ...form, source: tag(form.source), campaign: tag(form.campaign), amount: Number(form.amount) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn’t save that spend entry.");
      }
    },
    onSuccess: () => {
      toast.success("Spend logged");
      setForm((f) => ({ ...f, amount: "", note: "" }));
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/ad-spend?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: await jsonAuthHeaders() });
      if (!response.ok) throw new Error("Couldn’t remove that entry.");
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  const known = [...new Set(snapshot.acquisition.campaigns.map((c) => c.campaign).filter((c) => !c.startsWith("(")))];

  return (
    <Panel title="Log ad spend" hint="Copy the total from the ad platform for any period. Spend is spread evenly across the days it covers, then matched to campaigns by source and campaign name.">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sp-source">Source</Label>
          <Input id="sp-source" required value={form.source} onChange={set("source")} placeholder="google" />
        </div>
        <div className="space-y-1.5 sm:col-span-4">
          <Label htmlFor="sp-campaign">Campaign name</Label>
          <Input id="sp-campaign" required list="sp-campaigns" value={form.campaign} onChange={set("campaign")} placeholder="Same as utm_campaign" />
          <datalist id="sp-campaigns">{known.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sp-from">From</Label>
          <Input id="sp-from" type="date" required value={form.periodStart} onChange={set("periodStart")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sp-to">To</Label>
          <Input id="sp-to" type="date" required min={form.periodStart} value={form.periodEnd} onChange={set("periodEnd")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sp-amount">Amount spent (USD)</Label>
          <Input id="sp-amount" type="number" inputMode="decimal" min="0" step="0.01" required value={form.amount} onChange={set("amount")} placeholder="250.00" />
        </div>
        <div className="sm:col-span-6">
          <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Log spend"}</Button>
        </div>
      </form>

      {snapshot.acquisition.spend.length > 0 && (
        <div className="-mx-3 mt-5 overflow-x-auto border-t border-border pt-2">
          <table className="w-full min-w-[30rem]">
            <thead>
              <tr>
                <th className={TH}>Period</th>
                <th className={TH}>Source</th>
                <th className={TH}>Campaign</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {snapshot.acquisition.spend.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className={TD}>{entry.period_start === entry.period_end ? entry.period_start : `${entry.period_start} to ${entry.period_end}`}</td>
                  <td className={TD}>{entry.source}</td>
                  <td className={`${TD} font-medium`}>{entry.campaign}</td>
                  <td className={`${TD} text-right`}>{money(entry.amount_cents)}</td>
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => remove.mutate(entry.id)}
                      aria-label={`Remove ${entry.campaign} spend for ${entry.period_start}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ConversionExport({ snapshot }: { snapshot: AdminAnalyticsSnapshot }) {
  const rows = snapshot.acquisition.conversions;
  const byType = (type: string) => rows.filter((r) => r.clickIdType === type || (type === "google" && ["gclid", "gbraid", "wbraid"].includes(r.clickIdType)));
  const exportRows = (list: typeof rows, name: string) => {
    downloadCsv(
      `repofeed-conversions-${name}-${snapshot.range}.csv`,
      toCsv(
        ["Click ID", "Click ID type", "Conversion name", "Conversion time", "Campaign"],
        list.map((r) => [r.clickId, r.clickIdType, r.type === "paid" ? "Paid subscription" : "Signup", r.at, r.campaign]),
      ),
    );
  };
  const google = byType("google");
  return (
    <Panel
      title="Send conversions back to the ad platforms"
      hint="Ad platforms bid better when they know which clicks became signups and customers. These files hold only the platform’s own click ID and a timestamp. No names or emails."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={rows.length === 0} onClick={() => exportRows(rows, "all")}>
          <Download className="size-4" /> All conversions ({rows.length})
        </Button>
        <Button type="button" variant="outline" disabled={google.length === 0} onClick={() => exportRows(google, "google")}>
          <Download className="size-4" /> Google Ads ({google.length})
        </Button>
        <Button type="button" variant="outline" disabled={byType("li_fat_id").length === 0} onClick={() => exportRows(byType("li_fat_id"), "linkedin")}>
          <Download className="size-4" /> LinkedIn ({byType("li_fat_id").length})
        </Button>
        <Button type="button" variant="outline" disabled={byType("fbclid").length === 0} onClick={() => exportRows(byType("fbclid"), "meta")}>
          <Download className="size-4" /> Meta ({byType("fbclid").length})
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Nothing to export yet. A row appears here when someone who clicked an ad signs up.</p>
      )}
    </Panel>
  );
}

export default function ToolsTab({ snapshot }: { snapshot: AdminAnalyticsSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <LinkBuilder />
      <SpendLedger snapshot={snapshot} />
      <div className="xl:col-span-2">
        <ConversionExport snapshot={snapshot} />
      </div>
    </div>
  );
}
