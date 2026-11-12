import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bookmark, Check, ChevronsUpDown, CircleHelp, Compass, Clapperboard, CreditCard, FileText, GraduationCap, Layers, LifeBuoy, LogOut, Mail, Plus, Presentation, Search, Settings, Shield, TrendingUp } from "lucide-react";
import { SUPPORT_MAILTO } from "@/lib/site.ts";
import { api } from "@/lib/api/complete";
import { useAuth, useUser } from "@/hooks/use-auth.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { cn } from "@/lib/utils.ts";
import Logo from "@/components/logo.tsx";
import UserAvatar from "@/components/user-avatar.tsx";
import OfflineBanner from "@/components/offline-banner.tsx";
import PlanNotices from "@/components/plan-notices.tsx";
import CommandPalette, { openSearch } from "@/components/shell/command-palette.tsx";
import Guide, { openGuide } from "@/components/guide/guide.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

type NavItem = { to: string; label: string; icon: typeof Layers; editorOnly?: boolean; match?: (path: string, search: string) => boolean };

/** Watching comes first: most people in a workspace never make a study. */
const WATCH: NavItem[] = [
  { to: "/", label: "Feed", icon: Clapperboard, match: (p, q) => p === "/" && !q.includes("view=saved") },
  { to: "/?view=saved", label: "Saved", icon: Bookmark, match: (p, q) => p === "/" && q.includes("view=saved") },
  { to: "/explore", label: "Explore", icon: Compass },
];

const MAKE: NavItem[] = [
  { to: "/studies", label: "Studies", icon: Layers, editorOnly: true },
  { to: "/insights", label: "Insights", icon: BarChart3, editorOnly: true, match: (p) => p === "/insights" },
  { to: "/insights/deck", label: "Readout deck", icon: Presentation, editorOnly: true },
];

// Members only watch; they reach workspace settings (to see people or leave) from the workspace menu.
const MANAGE: NavItem[] = [
  { to: "/settings", label: "Workspace", icon: Settings, editorOnly: true },
  { to: "/billing", label: "Plan", icon: CreditCard, editorOnly: true },
];

const ROW =
  "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";
const ROW_ON = "bg-accent text-foreground";

/** "/insights/deck" becomes "nav-insights-deck"; the guided tour points at these. */
function tourName(to: string): string {
  const slug = to.split("?")[0].replace(/^\//, "").replace(/\//g, "-");
  return `nav-${to === "/?view=saved" ? "saved" : slug || "feed"}`;
}

function NavRow({ item }: { item: NavItem }) {
  const { pathname, search } = useLocation();
  const active = item.match ? item.match(pathname, search) : pathname.startsWith(item.to);
  return (
    <NavLink to={item.to} data-tour={tourName(item.to)} aria-current={active ? "page" : undefined} className={cn(ROW, active && ROW_ON)}>
      <item.icon className={cn("size-4", active && "text-primary")} />
      {item.label}
    </NavLink>
  );
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground/80">{label}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((n) => (
          <NavRow key={n.to} item={n} />
        ))}
      </div>
    </div>
  );
}

function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { workspaces, current, setCurrent, isEditor } = useWorkspace();
  const navigate = useNavigate();
  if (!current) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          compact && "w-auto min-w-0 max-w-[46vw] border-transparent bg-transparent",
        )}
        aria-label="Switch workspace"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded bg-foreground text-[11px] font-bold text-background">
          {current.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces?.map((w) => (
          <DropdownMenuItem key={w._id} onSelect={() => setCurrent(w)} className="cursor-pointer">
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            <span className="text-xs capitalize text-muted-foreground">{w.role}</span>
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
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: profile } = useQuery({ queryKey: ["users", "me"], queryFn: () => api.users.current() });
  const isAdmin = Boolean((profile as { is_admin?: boolean } | null | undefined)?.is_admin);
  const visible = (items: NavItem[]) => items.filter((n) => !n.editorOnly || isEditor);
  const onFeed = pathname === "/";
  // Five tabs at most on a phone; workspace settings move to the account menu there.
  const tabs: NavItem[] = [
    WATCH[0],
    WATCH[2],
    ...(isEditor ? [{ to: "/studies/new", label: "New", icon: Plus }, MAKE[0], MAKE[1]] : [WATCH[1]]),
  ];

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <CommandPalette />
      <Guide />
      <aside className="hidden w-[15.5rem] shrink-0 flex-col gap-5 border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <NavLink to="/" className="cursor-pointer px-1.5" aria-label="repofeed.ai home">
          <Logo />
        </NavLink>
        <WorkspaceSwitcher />
        <button type="button" data-tour="search" onClick={openSearch} className={cn(ROW, "w-full border border-border bg-background/60 font-normal")}>
          <Search className="size-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-border bg-card px-1.5 text-[11px] text-muted-foreground">⌘K</kbd>
        </button>
        <nav aria-label="Main" className="flex flex-col gap-5">
          <NavGroup label="Watch" items={visible(WATCH)} />
          <NavGroup label="Make" items={visible(MAKE)} />
          <NavGroup label="Manage" items={visible(MANAGE)} />
        </nav>
        {isEditor && (
          <NavLink
            to="/studies/new"
            data-tour="new-study"
            className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus className="size-4" /> New study
          </NavLink>
        )}
        <div className="mt-auto flex flex-col gap-0.5">
          {isAdmin && <NavRow item={{ to: "/admin/analytics", label: "Growth", icon: TrendingUp }} />}
          {isEditor && (
            <button type="button" onClick={openGuide} className={cn(ROW, "w-full")}>
              <GraduationCap className="size-4" /> Product tour
            </button>
          )}
          <NavRow item={{ to: "/help", label: "Help Center", icon: LifeBuoy }} />
          <div className="mt-2 flex items-center gap-2.5 border-t border-border px-1.5 pt-3">
            <UserAvatar name={user.name ?? user.email} src={user.avatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name ?? "Signed in"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signout()}
              className="grid size-9 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-1 border-b border-border bg-card px-2 py-1.5 lg:hidden">
          <NavLink to="/" aria-label="repofeed.ai home" className="cursor-pointer px-1">
            <Logo withText={false} />
          </NavLink>
          <WorkspaceSwitcher compact />
          <span className="flex-1" />
          <button
            type="button"
            onClick={openSearch}
            data-tour="search"
            aria-label="Search"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Search className="size-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Account menu" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
              <UserAvatar name={user.name ?? user.email} src={user.avatar} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">{user.email}</DropdownMenuLabel>
              {isEditor && (
                <DropdownMenuItem onSelect={() => navigate("/settings")} className="cursor-pointer">
                  <Settings className="size-4" /> Workspace and people
                </DropdownMenuItem>
              )}
              {isEditor && (
                <DropdownMenuItem onSelect={() => navigate("/billing")} className="cursor-pointer">
                  <CreditCard className="size-4" /> Plan and billing
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem onSelect={() => navigate("/admin/analytics")} className="cursor-pointer">
                  <TrendingUp className="size-4" /> Growth
                </DropdownMenuItem>
              )}
              {isEditor && (
                <DropdownMenuItem onSelect={openGuide} className="cursor-pointer">
                  <GraduationCap className="size-4" /> Product tour
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => navigate("/help")} className="cursor-pointer">
                <LifeBuoy className="size-4" /> Help Center
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signout()} className="cursor-pointer">
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <OfflineBanner />
        <PlanNotices />
        <main className={cn("min-h-0 flex-1 overflow-y-auto lg:pb-0", tabs.length > 1 && "pb-14", onFeed && "dark")}>
          <Outlet />
        </main>
        {tabs.length > 1 && (
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          >
            {tabs.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-tour={n.to === "/studies/new" ? "new-study" : tourName(n.to)}
                end={n.to === "/" || n.to === "/studies"}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    isActive && (n.match ? n.match(pathname, window.location.search) : true) && "text-primary",
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
