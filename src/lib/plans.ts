import type { Plan } from "@/schema/validators.ts";

export type Interval = "month" | "year";

export type PlanCard = {
  id: Plan;
  name: string;
  tagline: string;
  /** Monthly price in USD, by billing interval (yearly shown per month). */
  price: Record<Interval, number>;
  unit: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try it on a real study",
    price: { month: 0, year: 0 },
    unit: "forever",
    features: [
      "3 active studies (archived and demo studies don't count)",
      "1 editor",
      "Unlimited members and viewers",
      "Cited scenes, reactions and comments",
      "Share links and insights",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For the solo researcher",
    price: { month: 29, year: 24 },
    unit: "per month",
    features: [
      "Unlimited studies",
      "1 editor",
      "Unlimited members and viewers",
      "AI readout decks",
      "Uploaded footage and AI backdrops",
    ],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    tagline: "For research teams",
    price: { month: 59, year: 48 },
    unit: "per editor / month",
    features: [
      "Everything in Pro",
      "Unlimited editors (billed per seat, min. 2)",
      "Unlimited members and viewers",
      "Shared workspace for studies",
      "Priority support",
    ],
  },
];

/** Public list prices we benchmarked against (per editor, per month). Ours follows the billing toggle. */
export function comparison(interval: Interval) {
  const team = PLANS.find((p) => p.id === "team");
  return [
    { name: `repofeed.ai Team${interval === "year" ? " (yearly)" : ""}`, price: team ? formatPrice(team.price[interval]) : "" },
    { name: "Looppanel Pro", price: "~$79" },
    { name: "Condens Business", price: "~$100" },
    { name: "Dovetail / Marvin", price: "Quote only" },
  ];
}

export const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };

export function formatPrice(n: number): string {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}
