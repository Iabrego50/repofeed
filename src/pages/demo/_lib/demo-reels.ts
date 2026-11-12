import type { FindingType, Scene } from "@/schema/validators.ts";

const INT = "supperly-cancel-interviews.txt";
const CSV = "supperly-churn-survey.csv";
const DIARY = "supperly-diary-study.md";

export const DEMO_TRACKS = [
  "What customers say",
  "By the numbers",
  "At home",
  "What to fix",
];

type SeedFinding = {
  file: string;
  type: FindingType;
  text: string;
  speaker?: string;
  number?: string;
  label?: string;
  strength: number;
};

export type Footage = { url: string; caption: string };

type SeedReel = {
  track: number;
  title: string;
  /** Subject tags, as the AI would write them at generation time. */
  topics: string[];
  scenes: Scene[];
  /** Stock clip standing in for observational fieldwork recordings. */
  footage: Footage;
  findings: SeedFinding[];
};

const cta = (text: string, files: string[]): Scene => ({
  type: "cta",
  text,
  sub: `Source: ${files.join(", ")}`,
});

export const DEMO_REELS: SeedReel[] = [
  {
    track: 1,
    title: "Why people really leave",
    topics: ["cancellation", "pricing"],
    footage: { url: "/footage/receipts.mp4", caption: "Budget review · P04 · Week 6" },
    scenes: [
      { type: "hook", text: "Why do subscribers *actually* cancel?" },
      {
        type: "list",
        title: "Top reasons, n=1,140",
        items: [
          "Price at full rate · 29%",
          "Too much food · 22%",
          "Repetitive recipes · 17%",
          "Hard to skip · 14%",
        ],
      },
      cta("It's not *just* price.", [CSV]),
    ],
    findings: [
      { file: CSV, type: "stat", text: "Too expensive at full price was the main reason for cancelling", number: "29%", label: "main reason: too expensive at full price, n=1,140", strength: 3 },
      { file: CSV, type: "stat", text: "Too much food / wasted ingredients", number: "22%", label: "main reason: too much food, n=1,140", strength: 3 },
      { file: CSV, type: "stat", text: "Recipes got repetitive", number: "17%", label: "main reason: repetitive recipes, n=1,140", strength: 2 },
      { file: CSV, type: "stat", text: "Hard to skip or pause", number: "14%", label: "main reason: hard to skip or pause, n=1,140", strength: 2 },
    ],
  },
  {
    track: 0,
    title: "Help that became homework",
    topics: ["meal planning", "effort", "habit"],
    footage: { url: "/footage/mother-cooking.mp4", caption: "Home visit · P07 · Day 3" },
    scenes: [
      { type: "hook", text: "When does a meal kit stop *helping*?" },
      { type: "quote", text: "It stopped feeling like help and started feeling like homework.", by: "Parent of two, 7 months" },
      { type: "stat", num: "7 of 10", label: "said it started to feel like an obligation" },
      cta("Obligation is the *churn signal*.", [INT]),
    ],
    findings: [
      { file: INT, type: "quote", text: "It stopped feeling like help and started feeling like homework.", speaker: "Parent of two, subscribed 7 months", strength: 3 },
      { file: INT, type: "stat", text: "Said the subscription began to feel like an obligation rather than help", number: "7 of 10", label: "felt like an obligation, n=10 interviews", strength: 3 },
    ],
  },
  {
    track: 1,
    title: "The forgotten skip",
    topics: ["skipping", "reminders", "cancellation"],
    footage: { url: "/footage/box-at-door.mp4", caption: "Doorstep cam · P11 · Unwanted box" },
    scenes: [
      { type: "hook", text: "The cancel often starts with a *missed skip*." },
      { type: "stat", num: "46%", label: "forgot to skip a week they didn't want" },
      { type: "quote", text: "I skipped four weeks in a row and kept forgetting to skip the fifth. That's when I cancelled.", by: "Single professional, 3 months" },
      cta("Forgetting is a *design* problem.", [CSV, INT]),
    ],
    findings: [
      { file: CSV, type: "stat", text: "Ever forgot to skip a week they didn't want", number: "46%", label: "forgot to skip a week, n=1,140", strength: 3 },
      { file: INT, type: "quote", text: "I skipped four weeks in a row and kept forgetting to skip the fifth. That's when I cancelled.", speaker: "Single professional, subscribed 3 months", strength: 3 },
    ],
  },
  {
    track: 3,
    title: "Pause would have saved them",
    topics: ["pausing", "cancellation", "flexibility"],
    footage: { url: "/footage/calendar.mp4", caption: "Planning session · P02 · Day 9" },
    scenes: [
      { type: "hook", text: "What if pausing took *one tap*?" },
      { type: "stat", num: "41%", label: "would have paused instead if it were one tap" },
      { type: "quote", text: "If they'd just let me pause for a month I would have stayed.", by: "Single parent, 9 months" },
      cta("Make pause *easier* than cancel.", [CSV, INT]),
    ],
    findings: [
      { file: CSV, type: "stat", text: "Would have paused instead of cancelling if pausing were one tap", number: "41%", label: "would have paused, n=1,140", strength: 3 },
      { file: INT, type: "quote", text: "If they'd just let me pause for a month I would have stayed.", speaker: "Single parent, subscribed 9 months", strength: 3 },
    ],
  },
  {
    track: 2,
    title: "Fewer nights, please",
    topics: ["plan size", "flexibility", "food waste"],
    footage: { url: "/footage/family-dinner.mp4", caption: "Dinner obs · P09 · Night 2" },
    scenes: [
      { type: "hook", text: "Most homes want *fewer* kit nights." },
      { type: "stat", num: "52%", label: "want kits for just 3 nights a week" },
      { type: "quote", text: "I want to cook three nights, not five. The smallest plan is still too much food.", by: "Young family, 4 months" },
      cta("The smallest plan is *too big*.", [CSV, INT]),
    ],
    findings: [
      { file: CSV, type: "stat", text: "Want a kit for 3 nights a week", number: "52%", label: "want 3 nights a week, n=1,140", strength: 3 },
      { file: INT, type: "quote", text: "I want to cook three nights, not five. The smallest plan is still too much food.", speaker: "Young family, subscribed 4 months", strength: 3 },
    ],
  },
  {
    track: 2,
    title: "30 minutes takes 50",
    topics: ["cooking time", "effort"],
    footage: { url: "/footage/wall-clock.mp4", caption: "Cook-along · P05 · 18:42" },
    scenes: [
      { type: "hook", text: "The recipe card says *30 minutes*." },
      { type: "quote", text: "The 30-minute meals take me 50. Every single time.", by: "Parent of three, 5 months" },
      { type: "stat", num: "17 min", label: "average over the card's cook time" },
      cta("Cook times need to be *honest*.", [INT, CSV]),
    ],
    findings: [
      { file: INT, type: "quote", text: "The 30-minute meals take me 50. Every single time.", speaker: "Parent of three, subscribed 5 months", strength: 3 },
      { file: CSV, type: "stat", text: "Average actual cook time vs card time (self-reported)", number: "17 minutes", label: "minutes over card time, n=1,140", strength: 2 },
    ],
  },
  {
    track: 2,
    title: "What gets thrown out",
    topics: ["food waste", "portion size"],
    footage: { url: "/footage/half-onion.mp4", caption: "Prep cam · P03 · Week 2" },
    scenes: [
      { type: "hook", text: "Week two is when the *waste* shows up." },
      { type: "stat", num: "9 of 12", label: "homes threw out at least one ingredient" },
      { type: "list", title: "Most wasted", items: ["Fresh herbs", "Half onions", "The second avocado"] },
      cta("Waste feeds the *guilt*.", [DIARY]),
    ],
    findings: [
      { file: DIARY, type: "stat", text: "Households logged throwing away at least one ingredient in week 2", number: "9 of 12", label: "households threw away an ingredient, n=12", strength: 3 },
      { file: DIARY, type: "insight", text: "Most-wasted items: fresh herbs, half onions, the second avocado.", strength: 2 },
    ],
  },
  {
    track: 3,
    title: "The hidden cancel button",
    topics: ["cancellation flow", "trust"],
    footage: { url: "/footage/frustrated-phone.mp4", caption: "Cancel flow · P02 · Screen 7" },
    scenes: [
      { type: "hook", text: "Hard cancels leave a *bad* last taste." },
      { type: "quote", text: "Cancelling took seven screens. It felt like they were hiding the button on purpose.", by: "Single parent, 9 months" },
      { type: "line", kicker: "The cost", text: "A hidden button feels *on purpose* to customers." },
      cta("Make leaving *respectful*.", [INT]),
    ],
    findings: [
      { file: INT, type: "quote", text: "Cancelling took seven screens. It felt like they were hiding the button on purpose.", speaker: "Single parent, subscribed 9 months", strength: 3 },
    ],
  },
  {
    track: 1,
    title: "Kits that never get cooked",
    topics: ["food waste", "habit", "effort"],
    footage: { url: "/footage/takeout-tv.mp4", caption: "Evening obs · P08 · Day 4" },
    scenes: [
      { type: "hook", text: "How many kits get cooked *on plan*?" },
      { type: "stat", num: "61%", label: "of planned kit meals cooked that night" },
      { type: "line", kicker: "By day 4", text: "8 of 12 homes swapped a kit for *takeout* or leftovers." },
      cta("Plans slip by *midweek*.", [DIARY]),
    ],
    findings: [
      { file: DIARY, type: "stat", text: "Kits cooked on the planned night", number: "61%", label: "of planned kit meals, 168 diary entries", strength: 3 },
      { file: DIARY, type: "stat", text: "By day 4, households logged at least one kit meal swapped for takeout or leftovers", number: "8 of 12", label: "households swapped a kit meal by day 4", strength: 2 },
    ],
  },
  {
    track: 0,
    title: "It never learned me",
    topics: ["personalization", "recipes"],
    footage: { url: "/footage/mushrooms.mp4", caption: "Cook-along · P06 · Mushroom again" },
    scenes: [
      { type: "hook", text: "Ratings that go *nowhere*." },
      { type: "quote", text: "The app never learned anything about me. I've rated forty meals and it still suggests mushrooms.", by: "Professional, 8 months" },
      { type: "line", text: "Feedback that changes nothing feels like *wasted effort*." },
      cta("Show customers you *listened*.", [INT]),
    ],
    findings: [
      { file: INT, type: "quote", text: "The app never learned anything about me. I've rated forty meals and it still suggests mushrooms.", speaker: "Professional, subscribed 8 months", strength: 3 },
    ],
  },
];
