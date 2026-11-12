import type { Comment } from "@/lib/api/mappers.ts";
import type { CommentKind } from "@/schema/validators.ts";

const STUDY_ID = "demo";

function at(hoursAgo: number): number {
  return Date.now() - hoursAgo * 3_600_000;
}

function comment(opts: {
  id: string;
  reelId: string;
  kind: CommentKind;
  body: string;
  author: string;
  hoursAgo: number;
  parentId?: string;
}): Comment {
  const t = at(opts.hoursAgo);
  return {
    _id: opts.id,
    id: opts.id,
    _creationTime: t,
    reelId: opts.reelId,
    studyId: STUDY_ID,
    userId: opts.author.toLowerCase().replace(/\s+/g, "-"),
    guestId: null,
    parentId: opts.parentId ?? null,
    kind: opts.kind,
    body: opts.body,
    resolved: false,
    createdAt: new Date(t).toISOString(),
    updatedAt: new Date(t).toISOString(),
    author: { name: opts.author },
  };
}

/** Seeded stakeholder discussion for the fictional Supperly meal-kit study. */
export const DEMO_SEEDED_COMMENTS: Record<string, Comment[]> = {
  "demo-0": [
    comment({
      id: "c0-1",
      reelId: "demo-0",
      kind: "note",
      author: "Maya Chen",
      hoursAgo: 30,
      body: "29% on price is the headline, but 'too much food' at 22% is the one we can actually ship a fix for this quarter.",
    }),
    comment({
      id: "c0-2",
      reelId: "demo-0",
      kind: "question",
      author: "Jon Hale",
      hoursAgo: 26,
      body: "Was this only people who cancelled after the intro rate, or everyone?",
    }),
    comment({
      id: "c0-2r",
      reelId: "demo-0",
      kind: "note",
      author: "Priya Shah",
      hoursAgo: 25,
      parentId: "c0-2",
      body: "Everyone. I split out the first-month cohort and price is still the top reason.",
    }),
    comment({
      id: "c0-3",
      reelId: "demo-0",
      kind: "action",
      author: "Alex Ortiz",
      hoursAgo: 8,
      body: "Put a 3-night SKU on the next pricing test. I'll draft the brief by Friday.",
    }),
  ],
  "demo-1": [
    comment({
      id: "c1-1",
      reelId: "demo-1",
      kind: "note",
      author: "Renée Cole",
      hoursAgo: 20,
      body: "Homework is the word that came up on three of my save calls last month. It lands.",
    }),
    comment({
      id: "c1-2",
      reelId: "demo-1",
      kind: "question",
      author: "Priya Shah",
      hoursAgo: 18,
      body: "Is the obligation feeling stronger for parents than for couples? The quote is a parent of two.",
    }),
    comment({
      id: "c1-3",
      reelId: "demo-1",
      kind: "action",
      author: "Maya Chen",
      hoursAgo: 6,
      body: "Add 'does this still feel like help?' to the in-app pulse after week 6.",
    }),
  ],
  "demo-2": [
    comment({
      id: "c2-1",
      reelId: "demo-2",
      kind: "note",
      author: "Jon Hale",
      hoursAgo: 40,
      body: "46% forgot to skip. That's not a memory problem. Wednesday midnight is a terrible deadline.",
    }),
    comment({
      id: "c2-2",
      reelId: "demo-2",
      kind: "question",
      author: "Alex Ortiz",
      hoursAgo: 22,
      body: "If skip lived on the home screen instead of buried in the plan tab, would we still see this?",
    }),
    comment({
      id: "c2-3",
      reelId: "demo-2",
      kind: "action",
      author: "Maya Chen",
      hoursAgo: 10,
      body: "Prototype a one-tap skip from the delivery card. I'll pair with Alex this week.",
    }),
  ],
  "demo-3": [
    comment({
      id: "c3-1",
      reelId: "demo-3",
      kind: "note",
      author: "Renée Cole",
      hoursAgo: 16,
      body: "I hear 'I just needed a month off' constantly. Cancel is the only move they can find.",
    }),
    comment({
      id: "c3-2",
      reelId: "demo-3",
      kind: "question",
      author: "Jon Hale",
      hoursAgo: 14,
      body: "41% would have paused. Do we know how many actually tried to find pause and gave up?",
    }),
    comment({
      id: "c3-2r",
      reelId: "demo-3",
      kind: "note",
      author: "Priya Shah",
      hoursAgo: 12,
      parentId: "c3-2",
      body: "Not in this survey. Two interviewees mentioned hunting for it. Worth a follow-up item.",
    }),
    comment({
      id: "c3-3",
      reelId: "demo-3",
      kind: "action",
      author: "Alex Ortiz",
      hoursAgo: 5,
      body: "Make pause one tap from the same place as skip. Target: next app release.",
    }),
  ],
  "demo-4": [
    comment({
      id: "c4-1",
      reelId: "demo-4",
      kind: "note",
      author: "Maya Chen",
      hoursAgo: 28,
      body: "The smallest plan is still too big. That sentence should be on the pricing page.",
    }),
    comment({
      id: "c4-2",
      reelId: "demo-4",
      kind: "question",
      author: "Jon Hale",
      hoursAgo: 21,
      body: "Can ops actually fulfill a 3-night box without blowing up margin?",
    }),
    comment({
      id: "c4-3",
      reelId: "demo-4",
      kind: "action",
      author: "Priya Shah",
      hoursAgo: 9,
      body: "Run a 3-night waitlist in two cities. I'll write the screener.",
    }),
  ],
  "demo-5": [
    comment({
      id: "c5-1",
      reelId: "demo-5",
      kind: "note",
      author: "Alex Ortiz",
      hoursAgo: 18,
      body: "Seventeen minutes over, every time. The card is selling a night they don't have.",
    }),
    comment({
      id: "c5-2",
      reelId: "demo-5",
      kind: "question",
      author: "Priya Shah",
      hoursAgo: 11,
      body: "Are we timing from 'box open' or 'first chop'? Parents of three start from a messier kitchen.",
    }),
    comment({
      id: "c5-3",
      reelId: "demo-5",
      kind: "action",
      author: "Maya Chen",
      hoursAgo: 4,
      body: "Re-time the 20 most-cooked recipes with a parent panel. Honest numbers on the card.",
    }),
  ],
  "demo-6": [
    comment({
      id: "c6-1",
      reelId: "demo-6",
      kind: "note",
      author: "Renée Cole",
      hoursAgo: 15,
      body: "Half onions and the second avocado. People feel watched by their own fridge.",
    }),
    comment({
      id: "c6-2",
      reelId: "demo-6",
      kind: "question",
      author: "Alex Ortiz",
      hoursAgo: 13,
      body: "Could we ship split produce (half an onion, one avocado) without looking cheap?",
    }),
    comment({
      id: "c6-3",
      reelId: "demo-6",
      kind: "action",
      author: "Jon Hale",
      hoursAgo: 7,
      body: "Ask culinary for a no-waste add-on: smaller herb packs and single avocado. Cost it this sprint.",
    }),
  ],
  "demo-7": [
    comment({
      id: "c7-1",
      reelId: "demo-7",
      kind: "note",
      author: "Priya Shah",
      hoursAgo: 36,
      body: "Seven screens to cancel. They leave angry, then they tell that story, not the recipes.",
    }),
    comment({
      id: "c7-2",
      reelId: "demo-7",
      kind: "question",
      author: "Maya Chen",
      hoursAgo: 24,
      body: "Is anyone still arguing we need those save screens? The quote is brutal.",
    }),
    comment({
      id: "c7-2r",
      reelId: "demo-7",
      kind: "note",
      author: "Jon Hale",
      hoursAgo: 22,
      parentId: "c7-2",
      body: "Growth wanted them. After this clip I don't. A respectful goodbye plus a pause offer is enough.",
    }),
    comment({
      id: "c7-3",
      reelId: "demo-7",
      kind: "action",
      author: "Alex Ortiz",
      hoursAgo: 3,
      body: "Cut cancel to two screens: confirm, then a one-tap pause alternative. I'll spec it today.",
    }),
  ],
  "demo-8": [
    comment({
      id: "c8-1",
      reelId: "demo-8",
      kind: "note",
      author: "Priya Shah",
      hoursAgo: 19,
      body: "61% cooked on plan. By day 4, eight of twelve homes had already swapped a kit for takeout.",
    }),
    comment({
      id: "c8-2",
      reelId: "demo-8",
      kind: "question",
      author: "Renée Cole",
      hoursAgo: 12,
      body: "Do they skip the rest of the week after that first takeout night, or keep trying?",
    }),
    comment({
      id: "c8-3",
      reelId: "demo-8",
      kind: "action",
      author: "Maya Chen",
      hoursAgo: 6,
      body: "Trigger a midweek 'swap this meal' nudge on day 3, before the takeout habit kicks in.",
    }),
  ],
  "demo-9": [
    comment({
      id: "c9-1",
      reelId: "demo-9",
      kind: "note",
      author: "Alex Ortiz",
      hoursAgo: 14,
      body: "Forty ratings and still mushrooms. Feedback that changes nothing feels like a broken product.",
    }),
    comment({
      id: "c9-2",
      reelId: "demo-9",
      kind: "question",
      author: "Jon Hale",
      hoursAgo: 9,
      body: "Do we even train on ratings today, or is that screen a dead control?",
    }),
    comment({
      id: "c9-3",
      reelId: "demo-9",
      kind: "action",
      author: "Maya Chen",
      hoursAgo: 2,
      body: "Show a 'because you skipped mushrooms' line on the next menu. Make listening visible.",
    }),
  ],
};

/** Starting heart counts, aligned with the sample Insights "rings true" numbers. */
export const DEMO_SEED_HEARTS = [9, 8, 4, 7, 3, 6, 5, 10, 2, 6];
