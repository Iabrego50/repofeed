import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { useAuth, useUser } from "@/hooks/use-auth.ts";
import UserAvatar from "@/components/user-avatar.tsx";
import DeleteAccount from "@/pages/settings/_components/delete-account.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

/**
 * Bare essentials for native non-admin viewers: sign out + delete account.
 * Team/join-code settings stay on the desktop researcher web app.
 */
export default function NativeViewerAccountMenu() {
  const { signout } = useAuth();
  const user = useUser();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="native-account-menu"
          aria-label="Account menu"
          className="ml-auto grid size-10 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          <UserAvatar name={user.name ?? user.email} src={user.avatar} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signout()} className="cursor-pointer">
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" /> Delete account…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Required for App Store account deletion. Researchers manage team membership on the web.
            </DialogDescription>
          </DialogHeader>
          <DeleteAccount embedded />
        </DialogContent>
      </Dialog>
    </>
  );
}
