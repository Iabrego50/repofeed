import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { errorMessage } from "@/lib/errors.ts";

type PrefKey = "newStudies" | "feedback";

const OPTIONS: Array<{ key: PrefKey; title: string; description: string }> = [
  {
    key: "newStudies",
    title: "New studies",
    description: "When someone publishes a study in this workspace.",
  },
  {
    key: "feedback",
    title: "Feedback on your work",
    description: "When someone pushes back or asks a question on a study you made, or replies to your comment.",
  },
];

export default function EmailUpdates({ workspaceId }: { workspaceId: string }) {
  const { data: prefs } = useQuery({
    queryKey: ['emailPrefs', workspaceId],
    queryFn: async () => {
      const { getEmailPrefs } = await import('@/lib/api/email-prefs');
      return await getEmailPrefs(workspaceId);
    },
    enabled: !!workspaceId,
  });

  const setMutation = useMutation({
    mutationFn: async (update: Partial<{ newStudies: boolean; feedback: boolean }>) => {
      const { setEmailPrefs } = await import('@/lib/api/email-prefs');
      await setEmailPrefs({ workspaceId, ...update });
    },
  });

  const toggle = async (key: PrefKey, on: boolean) => {
    try {
      await setMutation.mutateAsync({ [key]: on });
      toast.success(on ? "Email updates turned on" : "Email updates turned off");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your email settings"));
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Mail className="size-5 text-primary" /> Email updates
      </h2>
      <div className="mt-1 text-sm text-muted-foreground">
        {prefs === undefined ? (
          <Skeleton className="h-4 w-64" />
        ) : prefs.email ? (
          <>Sent to <span className="font-medium text-foreground">{prefs.email}</span>. These settings are just for you, in this workspace.</>
        ) : (
          "Your account has no email address, so we can't send you updates."
        )}
      </div>
      <ul className="mt-4 divide-y divide-border">
        {OPTIONS.map((o) => (
          <li key={o.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <Label htmlFor={`email-${o.key}`} className="cursor-pointer font-medium">{o.title}</Label>
              <p className="text-sm text-muted-foreground">{o.description}</p>
            </div>
            {prefs === undefined ? (
              <Skeleton className="h-5 w-9 rounded-full" />
            ) : (
              <Switch
                id={`email-${o.key}`}
                className="cursor-pointer"
                checked={prefs[o.key]}
                disabled={!prefs.email}
                onCheckedChange={(on) => void toggle(o.key, on)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
