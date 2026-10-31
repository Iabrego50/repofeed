import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";

export default function PermissionDenied({ what }: { what: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <ErrorState>
        <ErrorStateHeader>
          <ErrorStateMedia variant="icon">
            <Lock />
          </ErrorStateMedia>
          <ErrorStateTitle>You don't have access</ErrorStateTitle>
          <ErrorStateDescription>
            Only editors and owners can {what}. Ask a workspace owner to change your role.
          </ErrorStateDescription>
        </ErrorStateHeader>
        <ErrorStateContent>
          <Button className="h-11" onClick={() => navigate("/")}>Go to the feed</Button>
        </ErrorStateContent>
      </ErrorState>
    </div>
  );
}
