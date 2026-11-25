/** Fixed mobile division feeds — one separate feed per slug, not a filter chip on a shared stream. */

export const DIVISION_SLUGS = ["auto", "gi", "wood", "marine", "website"] as const;

export type DivisionSlug = (typeof DIVISION_SLUGS)[number];

export const DIVISION_LABELS: Record<DivisionSlug, string> = {
  auto: "Auto",
  gi: "GI",
  wood: "Wood",
  marine: "Marine",
  website: "Website",
};

/** Design-system channel labels: CH 01 Auto … CH 05 Website */
export const DIVISION_CHANNEL_CODES: Record<DivisionSlug, string> = {
  auto: "CH 01",
  gi: "CH 02",
  wood: "CH 03",
  marine: "CH 04",
  website: "CH 05",
};

export const DIVISION_HINTS: Record<DivisionSlug, string> = {
  auto: "Automotive",
  gi: "General Industrial",
  wood: "Wood",
  marine: "Marine",
  website: "Website",
};

export const DIVISION_HOME_PATH = "/home";

export function isDivisionSlug(value: string | null | undefined): value is DivisionSlug {
  return typeof value === "string" && (DIVISION_SLUGS as readonly string[]).includes(value);
}

export function divisionFeedPath(slug: DivisionSlug): string {
  return `/d/${slug}`;
}

export function parseDivisionParam(value: string | null | undefined): DivisionSlug | undefined {
  return isDivisionSlug(value) ? value : undefined;
}
