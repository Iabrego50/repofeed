/**
 * Landing page copy, one entry per ad group.
 *
 * Ads convert best when the page repeats the promise the ad made, so each ad
 * group points at its own URL (`/for/<slug>`) with a matching headline. The
 * rest of the page is shared. Add an entry here to launch a new page; the
 * route, the page title and the link builder in /admin/analytics pick it up.
 */
export type LandingVariant = {
  slug: string;
  /** Shown in the admin link builder so you know which ad group it belongs to. */
  audience: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  sub: string;
};

export const DEFAULT_VARIANT: LandingVariant = {
  slug: "",
  audience: "Home page (brand and general traffic)",
  metaTitle: "repofeed.ai | Research your team will actually watch",
  metaDescription:
    "Upload interviews, surveys and notes. repofeed.ai turns them into short, cited scenes your team scrolls like a feed, reacts to and acts on.",
  headline: "Nobody reads the report. They’ll watch this.",
  sub: "Upload your interviews, surveys and field notes. repofeed turns the findings into short scenes, each with the quote and the source attached. Your team scrolls them like a feed, reacts, and asks questions right on the finding.",
};

export const LANDING_VARIANTS: LandingVariant[] = [
  {
    slug: "research-repository",
    audience: "Search: “research repository”, “UX research repository tool”",
    metaTitle: "A research repository people open | repofeed.ai",
    metaDescription:
      "A research repository with no tagging and no taxonomy to maintain. Upload your files and share findings as short, cited scenes.",
    headline: "A research repository people open without being asked.",
    sub: "There’s no tagging and no taxonomy to keep tidy. Upload the files you already have, and each finding comes out as a short scene with its quote and source attached. Everything stays organized by study.",
  },
  {
    slug: "dovetail-alternative",
    audience: "Search: “Dovetail alternative”, competitor terms",
    metaTitle: "A Dovetail alternative your stakeholders will scroll | repofeed.ai",
    metaDescription:
      "repofeed.ai takes finished research and turns it into a feed of short, cited scenes. Pay per editor. Viewers are free and need no account.",
    headline: "Looking for a Dovetail alternative? Try one your stakeholders will scroll.",
    sub: "repofeed isn’t another tagging workspace. It takes the research you’ve already done and turns it into a feed of short, cited scenes. You pay per editor, and the people watching never need a seat or an account.",
  },
  {
    slug: "share-research-findings",
    audience: "Search and social: “share research findings”, “socialize UX research”",
    metaTitle: "Share research findings people finish | repofeed.ai",
    metaDescription:
      "Send one private link. Stakeholders watch short research scenes, react and ask questions. You see who watched and where they pushed back.",
    headline: "Share research findings your stakeholders will finish.",
    sub: "Send one private link. They watch scenes that run about fifteen seconds each, react, and ask questions on the exact finding. You can see who watched, who made it to the end, and where they pushed back.",
  },
  {
    slug: "research-readouts",
    audience: "Social: researchers tired of readout decks",
    metaTitle: "Skip the forty-slide readout | repofeed.ai",
    metaDescription:
      "Turn a finished study into a feed of short scenes and an editable slide deck, both built from your own files and checked against them.",
    headline: "Skip the forty-slide readout. Send a feed instead.",
    sub: "Turn a finished study into scenes people can watch between meetings. When you do need slides, the readout deck is drafted from the same findings and downloads as PowerPoint you can edit.",
  },
  {
    slug: "interview-synthesis",
    audience: "Search: “interview synthesis tool”, “user interview analysis”",
    metaTitle: "From interview transcripts to findings people watch | repofeed.ai",
    metaDescription:
      "Drop in interview transcripts. repofeed.ai pulls out the findings, checks every quote against your file, and turns them into short scenes.",
    headline: "From a folder of transcripts to findings people watch.",
    sub: "Drop in your transcripts. repofeed pulls out the findings, checks every quote word for word against the file it came from, and drafts the scenes. You review and edit before anyone else sees them.",
  },
];

export function variantFor(slug: string | undefined): LandingVariant {
  if (!slug) return DEFAULT_VARIANT;
  return LANDING_VARIANTS.find((v) => v.slug === slug) ?? DEFAULT_VARIANT;
}
