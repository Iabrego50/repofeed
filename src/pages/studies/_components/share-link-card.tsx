// @ts-nocheck
import { useState } from "react";
import { useMutation, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { Copy, Globe, Link2, Link2Off } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { SHAREABLE_ORIGIN } from "@/lib/site.ts";

/** Editors create, copy and turn off the public view-only link for a published study. */
export default function ShareLinkCard({ studyId, published }: { studyId: Id<"studies">; published: boolean }) {
  const link = useQuery(api.share.getLink, { studyId });
  const create = useMutation(api.share.createLink);
  const revoke = useMutation(api.share.revokeLink);
  const setHideTeam = useMutation(api.share.setHideTeamComments);
  const [busy, setBusy] = useState(false);
  const url = link ? `${SHAREABLE_ORIGIN}/s/${link.token}` : "";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  const run = async (fn: () => Promise<void>, failMsg: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err, failMsg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Globe className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">View-only share link</p>
          <p className="text-sm text-muted-foreground">
            Anyone with the link can watch this study's scenes without an account. If they react or comment, they're asked for their name first.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {link === undefined ? (
          <Skeleton className="h-11 w-full" />
        ) : !published ? (
          <p className="text-sm text-muted-foreground">Publish the study to create a share link.</p>
        ) : link ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={url} className="h-11 font-mono text-xs" aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
              <Button className="h-11 shrink-0" onClick={() => void copy(url)}>
                <Copy className="size-4" /> Copy link
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {link.guestCount} {link.guestCount === 1 ? "guest has" : "guests have"} joined in
              </p>
              <Button
                variant="ghost"
                className="h-10 text-muted-foreground"
                disabled={busy}
                onClick={() => void run(async () => {
                  await revoke({ studyId });
                  toast.success("Link turned off. It no longer works.");
                }, "Couldn't turn off the link")}
              >
                {busy ? <Spinner /> : <Link2Off className="size-4" />} Turn off link
              </Button>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
              <Switch
                className="mt-0.5 cursor-pointer"
                checked={!link.hideTeamComments}
                onCheckedChange={(show) =>
                  void setHideTeam({ studyId, hide: !show }).catch((err: unknown) =>
                    toast.error(errorMessage(err, "Couldn't update the setting")),
                  )
                }
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Show team comments to guests</span>
                <span className="block text-xs text-muted-foreground">
                  Guests see teammates' names, never their photos. Turn off to keep internal discussion private.
                </span>
              </span>
            </label>
          </div>
        ) : (
          <Button
            className="h-11 font-semibold"
            disabled={busy}
            onClick={() => void run(async () => {
              const token = await create({ studyId });
              await copy(`${SHAREABLE_ORIGIN}/s/${token}`);
            }, "Couldn't create the link")}
          >
            {busy ? <Spinner /> : <Link2 className="size-4" />} Create share link
          </Button>
        )}
      </div>
    </div>
  );
}
