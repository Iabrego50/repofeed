import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { QueryClientProvider } from "./query-client.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryClientProvider>
        <WorkspaceProvider>
          <TooltipProvider>
            <Toaster theme="dark" position="top-center" />
            {children}
          </TooltipProvider>
        </WorkspaceProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
