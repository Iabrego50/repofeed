import { v, type Infer } from "convex/values";

/** Placeholder title for studies created before their details are filled in. */
export const UNTITLED_STUDY = "Untitled study";

export const roleValidator = v.union(
  v.literal("owner"),
  v.literal("editor"),
  v.literal("member"),
);
export type Role = Infer<typeof roleValidator>;

export const planValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("team"),
);
export type Plan = Infer<typeof planValidator>;

export const inviteRoleValidator = v.union(
  v.literal("editor"),
  v.literal("member"),
);

export const studyStatusValidator = v.union(
  v.literal("draft"),
  v.literal("generating"),
  v.literal("review"),
  v.literal("published"),
  v.literal("archived"),
);
export type StudyStatus = Infer<typeof studyStatusValidator>;

export const findingTypeValidator = v.union(
  v.literal("insight"),
  v.literal("quote"),
  v.literal("stat"),
  v.literal("recommendation"),
  v.literal("context"),
);
export type FindingType = Infer<typeof findingTypeValidator>;

export const sceneValidator = v.union(
  v.object({ type: v.literal("hook"), text: v.string() }),
  v.object({
    type: v.literal("line"),
    kicker: v.optional(v.string()),
    text: v.string(),
  }),
  v.object({
    type: v.literal("list"),
    title: v.string(),
    items: v.array(v.string()),
  }),
  v.object({ type: v.literal("stat"), num: v.string(), label: v.string() }),
  v.object({ type: v.literal("quote"), text: v.string(), by: v.string() }),
  v.object({ type: v.literal("cta"), text: v.string(), sub: v.string() }),
);
export type Scene = Infer<typeof sceneValidator>;

export const reactionKindValidator = v.union(
  v.literal("true"),
  v.literal("surprised"),
  v.literal("pushback"),
);
export type ReactionKind = Infer<typeof reactionKindValidator>;

export const commentKindValidator = v.union(
  v.literal("note"),
  v.literal("question"),
  v.literal("action"),
);
export type CommentKind = Infer<typeof commentKindValidator>;

export const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const jobPhaseValidator = v.union(
  v.literal("extract"),
  v.literal("compose"),
  v.literal("verify"),
  v.literal("done"),
);

export const logEntryValidator = v.object({
  at: v.string(),
  level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
  message: v.string(),
});

export const chunkValidator = v.object({
  sourceId: v.id("sources"),
  name: v.string(),
  start: v.number(),
  end: v.number(),
});

export const deckSlideValidator = v.object({
  type: v.union(
    v.literal("title"),
    v.literal("summary"),
    v.literal("finding"),
    v.literal("figures"),
    v.literal("voices"),
    v.literal("reactions"),
    v.literal("next_steps"),
    v.literal("closing"),
    // Engagement slides from earlier decks.
    v.literal("numbers"),
    v.literal("reach"),
    v.literal("completion"),
    v.literal("spotlight"),
  ),
  headline: v.string(),
  body: v.string(),
  reelTitle: v.optional(v.string()),
  quotes: v.optional(v.array(v.object({ text: v.string(), by: v.string() }))),
  items: v.optional(v.array(v.string())),
  // Figures copied from the study's findings.
  stats: v.optional(v.array(v.object({ num: v.string(), label: v.string() }))),
});

/** Snapshot of the numbers a deck was written from, so charts stay stable. */
export const deckStatsValidator = v.object({
  reached: v.number(),
  memberCount: v.number(),
  guestsReached: v.number(),
  totalViews: v.number(),
  completionRate: v.number(),
  openItems: v.number(),
  reactions: v.object({ true: v.number(), surprised: v.number(), pushback: v.number() }),
});

export const deckReelValidator = v.object({
  title: v.string(),
  track: v.string(),
  studyTitle: v.string(),
  views: v.number(),
  viewers: v.number(),
  completionRate: v.number(),
  trueCount: v.number(),
  surprisedCount: v.number(),
  pushbackCount: v.number(),
  commentCount: v.number(),
  openCount: v.number(),
});
