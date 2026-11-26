import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useAuth } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";

type Props = {
  /** When true, skip the outer card chrome (e.g. inside a dialog). */
  embedded?: boolean;
};

/**
 * App Store 5.1.1(v): in-app account deletion.
 * Confirms with the word DELETE, then calls POST /api/account/delete.
 */
export default function DeleteAccount({ embedded = false }: Props) {
  const { signOut, email } = useAuth();
  const [open, setOpen] = useState(embedded);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    if (confirm !== "DELETE" || busy) return;
    setBusy(true);
    try {
      await deleteAccount();
      toast.success("Your account has been deleted");
      await signOut();
      window.location.assign("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete your account");
      setBusy(false);
    }
  };

  const body = !open ? (
    <Button
      type="button"
      variant="outline"
      className="mt-4 h-11 border-destructive/40 text-destructive hover:bg-destructive/10"
      onClick={() => setOpen(true)}
    >
      Delete my account…
    </Button>
  ) : (
    <div className={embedded ? "space-y-3" : "mt-4 space-y-3"}>
      <div className="space-y-2">
        <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
        <Input
          id="delete-confirm"
          className="h-11"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          disabled={busy}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          className="h-11"
          disabled={busy || confirm !== "DELETE"}
          onClick={() => void onDelete()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Delete forever
        </Button>
        {!embedded && (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setConfirm("");
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Permanently delete {email ? <span className="font-medium text-foreground">{email}</span> : "your account"} and
          associated data. This cannot be undone.
        </p>
        {body}
      </div>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-destructive/30 bg-card p-5 shadow-lift">
      <p className="font-mono text-[11px] tracking-[0.14em] text-destructive uppercase">Danger zone</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-destructive">Delete account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently delete {email ? <span className="font-medium text-foreground">{email}</span> : "your account"} and
        associated workspace data you own. This cannot be undone.
      </p>
      {body}
    </section>
  );
}
