export type HelpCategory =
  | "Getting started"
  | "Building a study"
  | "Sharing and feedback"
  | "Insights and decks"
  | "Workspace and billing";

export type HelpArticle = {
  /** Stable id used in links like /help?article=flagged-scenes. */
  id: string;
  category: HelpCategory;
  title: string;
  summary: string;
  paragraphs?: string[];
  steps?: { title: string; body: string }[];
  bullets?: string[];
  tip?: string;
};

export const CATEGORIES: HelpCategory[] = [
  "Getting started",
  "Building a study",
  "Sharing and feedback",
  "Insights and decks",
  "Workspace and billing",
];

export const ARTICLES: HelpArticle[] = [
  {
    id: "how-it-works",
    category: "Getting started",
    title: "How repofeed.ai works",
    summary:
      "Turn research files into short scenes your team actually watches.",
    paragraphs: [
      "You add research files to a study, such as interview transcripts, survey exports or notes. AI reads them, picks out the strongest findings and writes 8 to 24 short scenes, each about one finding and 10 to 20 seconds long.",
      "Every quote and number is checked against your files before you publish. Once a study is published, its scenes appear in your workspace feed, where your team can watch, react and comment. You can also send a private link to people outside the workspace.",
    ],
    tip: "Want to see it first? Start a new study and choose Try sample files.",
  },
  {
    id: "roles",
    category: "Getting started",
    title: "Owners, editors and members",
    summary: "Who can do what in a workspace.",
    bullets: [
      "Owners: everything editors can do, plus managing the plan, billing and everyone's role.",
      "Editors: create and publish studies, invite members, and see Insights and readout decks.",
      "Members: watch the feed, react, comment and save scenes. Members are always free.",
      "Share-link viewers: anyone with a study's link can watch without an account. They add their name only if they react or comment.",
    ],
    tip: "Change roles or invite people from Workspace settings.",
  },
  {
    id: "create-study",
    category: "Building a study",
    title: "Creating a study, step by step",
    summary: "From raw files to published scenes in four steps.",
    steps: [
      {
        title: "Add your files",
        body: "Drop in PDF, Word, PowerPoint, Excel, text, CSV or subtitle files, up to 25 MB each. You can also paste text. Files are read in your browser and only the text is used.",
      },
      {
        title: "Check the details",
        body: "AI suggests a title, who the feed is for, and what they should walk away knowing. Edit anything, then choose Save and generate.",
      },
      {
        title: "Generate scenes",
        body: "AI reads your files, writes the scenes and checks every quote and number. It keeps running if you close the tab. If it stops partway, choose Resume where it stopped.",
      },
      {
        title: "Review and publish",
        body: "Preview each scene, edit wording, choose footage and decide which scenes to include. Then choose Publish to feed.",
      },
    ],
  },
  {
    id: "flagged-scenes",
    category: "Building a study",
    title: 'What "flagged by verification" means',
    summary: "Why some scenes are held back, and how to fix them.",
    paragraphs: [
      "After writing the scenes, the app checks every quote word for word, and every number, against your files. If something can't be matched, the scene is flagged with a yellow warning that explains what didn't match.",
      "Flagged scenes are left out of the feed until you deal with them. This protects you from sharing a quote someone never said.",
    ],
    bullets: [
      "Use the Flagged filter at the top of the review step to see only flagged scenes.",
      "Choose Edit and change the wording so it matches your files exactly.",
      "Or, if you're sure it's right (for example, a quote that was lightly tidied up), turn on Included to use it anyway.",
    ],
  },
  {
    id: "review-publish",
    category: "Building a study",
    title: "Reviewing, editing and publishing",
    summary: "Decide exactly what your team sees.",
    bullets: [
      "Tap a scene's preview to watch it full screen.",
      "Use the Included switch to leave a scene in or out of the feed.",
      "Choose Edit to reword a scene's text.",
      "Choose Publish to feed when you're ready. You can unpublish at any time to hide the study again.",
      "Not happy with the scenes? Go back to the generate step and choose Regenerate.",
    ],
  },
  {
    id: "footage-backdrops",
    category: "Building a study",
    title: "Footage and AI backdrops",
    summary:
      "Set scenes over your own video, stock clips or an AI-generated video.",
    paragraphs: [
      "Each scene plays over a background. New scenes automatically get a short AI video. Until that render finishes, or if it fails, a stock clip plays so the scene is never blank.",
    ],
    bullets: [
      "Your own clips: upload MP4, MOV or WebM videos up to 60 MB. Clips are stored securely and everyone in the workspace can reuse them. You can delete a clip at any time.",
      'Stock clips: pick from the built-in library. You can add a short caption, like "Home visit, day 3". Stock is also the fallback while an AI video is rendering.',
      "AI video: after generation, each scene gets a short vertical Grok Imagine clip. Opening Review backfills any scene that still needs one. Use Create AI backdrops only if you still want a painted still.",
    ],
    tip: "AI videos are capped per study (free 6, pro 12, team 24) and never regenerated once they exist.",
  },
  {
    id: "share-links",
    category: "Sharing and feedback",
    title: "Sharing a study with a private link",
    summary: "Let stakeholders watch without creating an account.",
    paragraphs: [
      "Once a study is published, its review step shows a share link card. Copy the link and send it by email or chat.",
    ],
    bullets: [
      "Anyone with the link can watch. No sign-up, password or app needed.",
      "Viewers are asked for their name only when they react or comment.",
      "Choose whether guests can see your team's comments.",
      "Turn the link off at any time and it stops working right away.",
    ],
  },
  {
    id: "reactions-comments",
    category: "Sharing and feedback",
    title: "Reactions, comments and action items",
    summary: "How your team talks back on each scene.",
    bullets: [
      "Rings true, Surprised me and Push back: one reaction per person per scene.",
      "Comments can be a Note, a Question or an Action item. Anyone can reply.",
      "Questions and action items can be marked Resolved, and reopened later. Unresolved ones show as Open items in Insights.",
      "Tap the bookmark to save a scene to your private Saved list, and use the magnifying glass to search every scene.",
    ],
  },
  {
    id: "insights",
    category: "Insights and decks",
    title: "Reading your Insights numbers",
    summary: "What each number on the Insights page means.",
    bullets: [
      "People reached: how many team members watched at least one scene, plus named guests from share links.",
      "Finished: the share of viewers who watched to the end of a scene.",
      "Open items: questions and action items nobody has resolved yet.",
      "Total plays: counts at most one play per person, per scene, per day, so repeat watching doesn't inflate it.",
      "Use Everyone, Team or Guests to narrow the numbers, and pick a single study from the menu.",
      "Click the People number on any scene to see exactly who watched it.",
      "Download Scene stats CSV or Comments CSV to use the data in a spreadsheet.",
    ],
  },
  {
    id: "readout-decks",
    category: "Insights and decks",
    title: "Readout slide decks",
    summary: "A presentation of your findings, written for you.",
    paragraphs: [
      "Choose Readout deck in the sidebar, or Create readout deck on a published study or in Insights, then Generate deck. AI reads what your studies found and writes a short readout: the outcomes, the evidence behind them and recommended next steps. It usually takes under a minute.",
      "Present it full screen in the browser, or download it as PowerPoint. Every headline, chart and quote is editable text. When new research comes in, make a fresh version.",
    ],
    tip: "Readout decks are part of the Pro and Team plans.",
  },
  {
    id: "plans-limits",
    category: "Workspace and billing",
    title: "Plans, trials and the free study limit",
    summary: "What counts toward your limits and how billing works.",
    bullets: [
      "The Free plan includes 3 active studies. Archived studies and the demo study don't count, so archiving a study frees up a slot.",
      "You pay for editors only. Members and share-link viewers are always free.",
      "Every paid plan starts with a 14-day free trial, one per person.",
      "Team is billed per editor seat, with a minimum of 2 seats.",
      "If a payment fails or a plan ends, your studies are kept. Some features pause until the plan is restored from Plan and billing.",
    ],
  },
  {
    id: "refunds",
    category: "Workspace and billing",
    title: "Refunds",
    summary: "When we refund a charge, and how to ask.",
    paragraphs: [
      "Paid plans are billed in advance. You can cancel anytime from Plan and billing; the plan stays active through the period you have already paid for.",
      "Except where the law requires a refund, payments are not refunded after a paid period has started. If we charged you by mistake, you never received access, or a charge looks wrong, email support and we will review it.",
    ],
    bullets: [
      "Trials: cancel before the trial ends and you will not be charged.",
      "Duplicate or incorrect charges: we refund these once we confirm them.",
      "Required by law: we refund when consumer law in your location says we must.",
    ],
    tip: "Email support@repofeed.ai from the account that was charged and include the invoice date.",
  },
  {
    id: "contact",
    category: "Workspace and billing",
    title: "Contacting support",
    summary: "Still stuck? We're happy to help.",
    paragraphs: [
      "Email us using the button at the top of this page, or choose Email support in the workspace menu. Tell us what you were trying to do and what happened, and include a screenshot if you can.",
    ],
  },
];

export function articleText(a: HelpArticle): string {
  return [
    a.title,
    a.summary,
    ...(a.paragraphs ?? []),
    ...(a.bullets ?? []),
    ...(a.steps ?? []).flatMap((s) => [s.title, s.body]),
    a.tip ?? "",
  ]
    .join(" ")
    .toLowerCase();
}
