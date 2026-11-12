import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online.ts";

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-mark px-3 py-2 text-sm font-medium text-mark-foreground"
    >
      <WifiOff className="size-4" />
      You're offline. Scenes and comments will update when you reconnect.
    </div>
  );
}
