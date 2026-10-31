import { ConvexError } from "convex/values";
import { toast } from "sonner";

/** Extracts a readable message from a Convex error, with a fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string };
    return data.message ?? fallback;
  }
  return fallback;
}

/** Shows an error toast; plan-limit errors get a shortcut to the billing page. */
export function toastError(err: unknown, fallback: string): void {
  const message = errorMessage(err, fallback);
  const needsUpgrade = err instanceof ConvexError && /part of Pro|Team plan|Upgrade/i.test(message);
  toast.error(message, needsUpgrade ? { action: { label: "See plans", onClick: () => window.location.assign("/billing") } } : undefined);
}
