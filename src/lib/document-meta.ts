import { DEFAULT_VARIANT, LANDING_VARIANTS } from "../pages/landing/variants";

export type RouteMeta = {
  title: string;
  description: string;
  robots?: string;
};

const DEFAULT_TITLE = DEFAULT_VARIANT.metaTitle;
const DEFAULT_DESCRIPTION = DEFAULT_VARIANT.metaDescription;

export const DEFAULT_ROUTE_META: RouteMeta = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
};

const EXACT: Record<string, RouteMeta> = {
  "/": DEFAULT_ROUTE_META,
  // Ad landing pages share the home page's content, so search engines are pointed at "/" only.
  ...Object.fromEntries(
    LANDING_VARIANTS.map((v) => [`/for/${v.slug}`, { title: v.metaTitle, description: v.metaDescription, robots: "noindex,follow" }]),
  ),
  "/demo": {
    title: "Demo — repofeed.ai",
    description: "Watch a sample research feed and see how cited insight scenes work.",
  },
  "/demo/deck": {
    title: "Sample readout deck | repofeed.ai",
    description: "Generate a sample research readout deck from the demo study and download it as PowerPoint.",
  },
  "/demo/insights": {
    title: "Insights demo — repofeed.ai",
    description: "See how repofeed.ai shows who watched research scenes and where they pushed back.",
  },
  "/demo/explore": {
    title: "Explore demo — repofeed.ai",
    description: "Search a sample research study by topic or keyword, or ask a question and see which insights answer it.",
  },
  "/help": {
    title: "Help — repofeed.ai",
    description: "Guides for building studies, sharing scenes, reading Insights and managing your workspace.",
  },
  "/signin": {
    title: "Sign in — repofeed.ai",
    description: "Sign in to repofeed.ai with a magic link to get back to your research feed.",
  },
  "/login": {
    title: "Sign in — repofeed.ai",
    description: "Sign in to repofeed.ai with a magic link to get back to your research feed.",
  },
  "/auth": {
    title: "Sign in — repofeed.ai",
    description: "Sign in to repofeed.ai with a magic link to get back to your research feed.",
  },
  "/auth/callback": {
    title: "Signing you in — repofeed.ai",
    description: "Finishing sign-in to repofeed.ai.",
    robots: "noindex",
  },
  "/auth/confirm": {
    title: "Confirming your email — repofeed.ai",
    description: "Confirming your email so you can sign in to repofeed.ai on this device.",
    robots: "noindex",
  },
  "/terms": {
    title: "Terms of Service — repofeed.ai",
    description: "The terms for using repofeed.ai, including accounts, billing and acceptable use.",
  },
  "/privacy": {
    title: "Privacy Policy — repofeed.ai",
    description: "How repofeed.ai collects, uses and stores account, research and billing data.",
  },
  "/welcome": {
    title: "Create a workspace — repofeed.ai",
    description: "Set up your first research workspace on repofeed.ai.",
    robots: "noindex",
  },
  "/feed": {
    title: "Feed — repofeed.ai",
    description: "Watch research scenes from your workspace.",
    robots: "noindex",
  },
  "/studies": {
    title: "Studies — repofeed.ai",
    description: "Your research studies on repofeed.ai.",
    robots: "noindex",
  },
  "/studies/new": {
    title: "New study — repofeed.ai",
    description: "Create a study from research files on repofeed.ai.",
    robots: "noindex",
  },
  "/insights": {
    title: "Insights — repofeed.ai",
    description: "See who watched your research scenes and what they said.",
    robots: "noindex",
  },
  "/insights/deck": {
    title: "Readout deck — repofeed.ai",
    description: "A presentation of your findings, written from your studies.",
    robots: "noindex",
  },
  "/settings": {
    title: "Workspace settings — repofeed.ai",
    description: "Manage members, invites and workspace details.",
    robots: "noindex",
  },
  "/billing": {
    title: "Plan and billing — repofeed.ai",
    description: "Choose a plan and manage your repofeed.ai subscription.",
    robots: "noindex",
  },
  "/admin/analytics": {
    title: "Page not found — repofeed.ai",
    description: "This scene doesn't exist. The link may be old or mistyped.",
    robots: "noindex,nofollow",
  },
};

const PREFIX: Array<{ prefix: string; meta: RouteMeta }> = [
  {
    prefix: "/studies/",
    meta: {
      title: "Study — repofeed.ai",
      description: "Review and publish cited insight scenes from a research study.",
      robots: "noindex",
    },
  },
  {
    prefix: "/invite/",
    meta: {
      title: "Workspace invite — repofeed.ai",
      description: "You've been invited to join a research workspace on repofeed.ai.",
      robots: "noindex",
    },
  },
  {
    prefix: "/s/",
    meta: {
      title: "Shared study — repofeed.ai",
      description: "Watch a shared research feed. No account needed.",
      robots: "noindex",
    },
  },
  {
    prefix: "/share/",
    meta: {
      title: "Shared study — repofeed.ai",
      description: "Watch a shared research feed. No account needed.",
      robots: "noindex",
    },
  },
];

export const NOT_FOUND_META: RouteMeta = {
  title: "Page not found — repofeed.ai",
  description: "This scene doesn't exist. The link may be old or mistyped.",
  robots: "noindex",
};

export function metaForPath(pathname: string): RouteMeta {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (EXACT[path]) return EXACT[path];
  const prefixed = PREFIX.find((entry) => path.startsWith(entry.prefix));
  if (prefixed) return prefixed.meta;
  return NOT_FOUND_META;
}
