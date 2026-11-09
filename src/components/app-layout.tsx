import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Clapperboard, CreditCard, FolderPlus, Layers, LogOut, Settings, ChevronsUpDown, Check, CircleHelp, FileText, LifeBuoy, Mail, Plus, Shield } from "lucide-react";
import { SUPPORT_MAILTO } from "@/lib/site.ts";
import { useAuth, useUser } from "@/hooks/use-auth.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { cn } from "@/lib/utils.ts";
import Logo from "@/components/logo.tsx";
import UserAvatar from "@/components/user-avatar.tsx";
import OfflineBanner from "@/components/offline-banner.tsx";
import PlanNotices from "@/components/plan-notices.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

type NavItem = { to: string; label: string; icon: typeof Layers; editorOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "Feed", icon: Clapperboard },
  { to: "/studies", label: "Studies", icon: Layers, editorOnly: true },
  { to: "/insights", label: "Insights", icon: BarChart3, editorOnly: true },
  // Members only watch; they reach workspace settings (to see people or leave) from the workspace menu.
  { to: "/settings", label: "Workspace", icon: Settings, editorOnly: true },
  { to: "/billing", label: "Plan", icon: CreditCard, editorOnly: true },
];

function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { workspaces, current, setCurrent, isEditor } = useWorkspace();
  const navigate = useNavigate();
  if (!current) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          compact && "w-auto max-w-[55vw] px-2",
        )}
        aria-label="Switch workspace"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary font-mono text-xs font-bold">
          {current.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces?.map((w) => (
          <DropdownMenuItem key={w._id} onSelect={() => setCurrent(w)} className="cursor-pointer">
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{w.role}</span>
            {w._id === current?._id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings")} className="cursor-pointer">
          <Settings className="size-4" /> Workspace settings
        </DropdownMenuItem>
        {isEditor && (
          <DropdownMenuItem onSelect={() => navigate("/billing")} className="cursor-pointer">
            <CreditCard className="size-4" /> Plan and billing
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => navigate("/?tour=1")} className="cursor-pointer">
          <CircleHelp className="size-4" /> Feed tour
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/welcome")} className="cursor-pointer">
          <Plus className="size-4" /> New workspace
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Help and support
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate("/help")} className="cursor-pointer">
          <LifeBuoy className="size-4" /> Help Center
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <a href={SUPPORT_MAILTO}>
            <Mail className="size-4" /> Email support
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/terms")} className="cursor-pointer">
          <FileText className="size-4" /> Terms of Service
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/privacy")} className="cursor-pointer">
          <Shield className="size-4" /> Privacy Policy
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppLayout() {
  const { isEditor } = useWorkspace();
  const { signout } = useAuth();
  const user = useUser();
  const items = NAV.filter((n) => !n.editorOnly || isEditor);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border px-3 py-5 lg:flex">
        <NavLink to="/" className="cursor-pointer px-3 pb-6" aria-label="repofeed.ai home">
          <Logo />
        </NavLink>
        <WorkspaceSwitcher />
        <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                  isActive && "bg-secondary text-foreground",
                )
              }
            >
              <n.icon className="size-[18px]" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        {isEditor && (
          <NavLink
            to="/studies/new"
            className="mt-6 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <FolderPlus className="size-4" /> New study
          </NavLink>
        )}
        <NavLink
          to="/help"
          className={({ isActive }) =>
            cn(
              "mt-auto flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              isActive && "bg-secondary text-foreground",
            )
          }
        >
          <LifeBuoy className="size-[18px]" /> Help Center
        </NavLink>
        <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <UserAvatar name={user.name ?? user.email} src={user.avatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? "Signed in"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signout()}
            className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 lg:hidden">
          <NavLink to="/" aria-label="repofeed.ai home" className="cursor-pointer">
            <Logo withText={false} />
          </NavLink>
          <WorkspaceSwitcher compact />
          <NavLink
            to="/help"
            aria-label="Help Center"
            className={({ isActive }) =>
              cn(
                "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                isActive && "bg-secondary text-primary",
              )
            }
          >
            <LifeBuoy className="size-5" />
          </NavLink>
          <button
            type="button"
            onClick={() => void signout()}
            className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        <OfflineBanner />
        <PlanNotices />
        <main className={cn("min-h-0 flex-1 overflow-y-auto lg:pb-0", items.length > 1 && "pb-16")}>
          <Outlet />
        </main>
        {items.length > 1 && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {[...items.filter((n) => n.to !== "/billing"), ...(isEditor ? [{ to: "/studies/new", label: "New", icon: FolderPlus }] : [])].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/" || n.to === "/studies"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  isActive && "text-primary",
                )
              }
            >
              <n.icon className="size-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        )}
      </div>
    </div>
  );
}
