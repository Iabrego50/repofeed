import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Copy, Link2, Trash2, UserMinus, Loader2 } from "lucide-react";
import type { Role } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select.tsx";
import PageHeader from "@/components/page-header.tsx";
import UserAvatar from "@/components/user-avatar.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { SHAREABLE_ORIGIN } from "@/lib/site.ts";
import EmailUpdates from "./_components/email-updates.tsx";

const inviteUrl = (token: string) => `${SHAREABLE_ORIGIN}/invite/${token}`;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Invite link copied");
  } catch {
    toast.error("Couldn't copy. Select the link and copy it manually.");
  }
}

function Invites({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { data: invites } = useQuery({
    queryKey: ["workspaces", "invites", workspaceId],
    queryFn: () => api.workspaces.listInvites({ workspaceId }),
  });

  const createMutation = useMutation({
    mutationFn: (args: { workspaceId: string; role: "editor" | "member"; expiresInDays: number; maxUses: number }) =>
      api.billing.actions.createInvite(args),
  });

  const revokeMutation = useMutation({
    mutationFn: (args: { workspaceId: string; inviteId: string }) =>
      api.workspaces.revokeInvite(args),
  });

  const [role, setRole] = useState<"member" | "editor">("member");
  const [days, setDays] = useState("7");
  const [uses, setUses] = useState("10");
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Invite people</h2>
      <p className="mt-1 text-sm text-muted-foreground">Anyone with the link can join until it expires or runs out of uses.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect id="invite-role" className="h-11 w-full" value={role} onChange={(e) => setRole(e.target.value === "editor" ? "editor" : "member")}>
            <NativeSelectOption value="member">Member: watch and discuss</NativeSelectOption>
            {isOwner && <NativeSelectOption value="editor">Editor: create and publish</NativeSelectOption>}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-days">Expires after</Label>
          <NativeSelect id="invite-days" className="h-11 w-full" value={days} onChange={(e) => setDays(e.target.value)}>
            <NativeSelectOption value="1">1 day</NativeSelectOption>
            <NativeSelectOption value="7">7 days</NativeSelectOption>
            <NativeSelectOption value="30">30 days</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-uses">Can be used</Label>
          <NativeSelect id="invite-uses" className="h-11 w-full" value={uses} onChange={(e) => setUses(e.target.value)}>
            <NativeSelectOption value="1">Once</NativeSelectOption>
            <NativeSelectOption value="10">Up to 10 times</NativeSelectOption>
            <NativeSelectOption value="50">Up to 50 times</NativeSelectOption>
            <NativeSelectOption value="500">Up to 500 times</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button
          className="h-11 font-semibold"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await createMutation.mutateAsync({ workspaceId, role, expiresInDays: Number(days), maxUses: Number(uses) });
              await copy(inviteUrl(result.token));
            } catch (err: any) {
              toast.error(err.message || "Couldn't create the invite");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create link
        </Button>
      </div>
      <ul className="mt-5 space-y-2">
        {invites === undefined ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : invites.length === 0 ? (
          <li className="text-sm text-muted-foreground">No active invite links.</li>
        ) : (
          invites.map((inv: any) => (
            <li key={inv._id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
              <Input readOnly value={inviteUrl(inv.token)} className="h-10 min-w-0 flex-1 font-mono text-xs" aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
              <span className="font-mono text-xs text-muted-foreground">
                {inv.role} · expires {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })} · {inv.uses}{inv.maxUses !== null ? ` of ${inv.maxUses}` : ""} joined
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-11" aria-label="Copy invite link" onClick={() => void copy(inviteUrl(inv.token))}>
                  <Copy className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-11" aria-label="Revoke invite link" onClick={() => void revokeMutation.mutate({ workspaceId, inviteId: inv._id })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function Members({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { data: members } = useQuery({
    queryKey: ["workspaces", "members", workspaceId],
    queryFn: () => api.workspaces.listMembers({ workspaceId }),
  });

  const removeMutation = useMutation({
    mutationFn: (args: { workspaceId: string; userId: string }) =>
      api.workspaces.removeMember(args),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Members {members && <span className="font-mono text-sm text-muted-foreground">{members.length}</span>}</h2>
      <ul className="mt-4 divide-y divide-border">
        {members === undefined
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="my-2 h-12 w-full" />)
          : members.map((m: any) => {
              return (
                <li key={m._id} className="flex flex-wrap items-center gap-3 py-3">
                  <UserAvatar name={m.name} src={m.avatar} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}{m.isMe && <span className="text-muted-foreground"> (you)</span>}</p>
                    {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                  </div>
                  <span className="font-mono text-xs uppercase text-muted-foreground">{m.role}</span>
                  {(isOwner || m.isMe) && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-11" 
                      aria-label={m.isMe ? "Leave workspace" : `Remove ${m.name}`} 
                      onClick={() => removeMutation.mutate({ workspaceId, userId: m._id })}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </li>
              );
            })}
      </ul>
    </section>
  );
}

export default function SettingsPage() {
  const { current, isEditor, isOwner } = useWorkspace();
  const renameMutation = useMutation({
    mutationFn: (args: { workspaceId: string; name: string }) =>
      api.workspaces.rename(args),
  });
  
  const [name, setName] = useState<string | null>(null);
  
  if (!current) return null;
  
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 lg:py-12">
      <PageHeader eyebrow="Workspace" title={current.name} description={`You're ${current.role === "owner" ? "an owner" : current.role === "editor" ? "an editor" : "a member"} of this workspace.`} />
      {isOwner && (
        <form
          className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await renameMutation.mutateAsync({ workspaceId: current._id, name: name ?? current.name });
              toast.success("Workspace renamed");
              setName(null);
            } catch (err: any) {
              toast.error(err.message || "Couldn't rename");
            }
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="ws-rename">Workspace name</Label>
            <Input id="ws-rename" className="h-11" value={name ?? current.name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <Button type="submit" className="h-11" disabled={name === null || name.trim() === current.name}>Save</Button>
        </form>
      )}
      {isEditor && <Invites workspaceId={current._id} isOwner={isOwner} />}
      <EmailUpdates workspaceId={current._id} />
      <Members workspaceId={current._id} isOwner={isOwner} />
    </div>
  );
}
