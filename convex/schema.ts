import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  chunkValidator,
  commentKindValidator,
  deckReelValidator,
  deckSlideValidator,
  deckStatsValidator,
  findingTypeValidator,
  inviteRoleValidator,
  jobPhaseValidator,
  jobStatusValidator,
  logEntryValidator,
  reactionKindValidator,
  roleValidator,
  sceneValidator,
  studyStatusValidator,
} from "./schema/validators";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatar: v.optional(v.string()),
    // ISO time the user finished or skipped the feed tour; unset means show it.
    onboardedAt: v.optional(v.string()),
    // ISO time this person first started a paid plan; one free trial per person.
    trialUsedAt: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  workspaces: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    // Hercules Commerce customer; the workspace is the billable entity.
    customerId: v.optional(v.string()),
    // Billing hints written after live plan checks. Access is still decided by Commerce.
    // Variant and seat count of the latest checkout, so Team seats can follow editor changes.
    seatVariant: v.optional(v.string()),
    seats: v.optional(v.number()),
    billingReturnUrl: v.optional(v.string()),
    // Who started the latest checkout; their free trial is marked used once it's paid.
    checkoutBy: v.optional(v.id("users")),
    // Last paid plan seen; set while paid, so a drop to Free can be flagged to owners.
    paidPlan: v.optional(v.union(v.literal("pro"), v.literal("team"))),
    // Set when a paid plan ended (cancelled or payment failed) until it's renewed or dismissed.
    lapsedPlan: v.optional(v.union(v.literal("pro"), v.literal("team"))),
    // More editors than the plan allows; non-owner editors are paused (treated as members).
    seatOverage: v.optional(v.boolean()),
  }),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: roleValidator,
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_and_user", ["workspaceId", "userId"])
    .index("by_workspace_and_role", ["workspaceId", "role"]),

  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    token: v.string(),
    role: inviteRoleValidator,
    expiresAt: v.string(),
    createdBy: v.id("users"),
    revoked: v.boolean(),
    uses: v.number(),
    // Unset on older invites, which stay unlimited until they expire.
    maxUses: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_creator", ["workspaceId", "createdBy"]),

  // People an owner removed; old invite links can't bring them back.
  workspaceRemovals: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  }).index("by_workspace_and_user", ["workspaceId", "userId"]),

  // Each person's email update choices per workspace. No row means everything is on.
  emailPrefs: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    newStudies: v.boolean(),
    feedback: v.boolean(),
  }).index("by_workspace_and_user", ["workspaceId", "userId"]),

  // Fixed-window usage counters that cap costly or spammable actions.
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.string(),
    count: v.number(),
  }).index("by_key", ["key"]),

  // Which workspace an uploaded file belongs to, so it can't be reused or deleted elsewhere.
  uploadClaims: defineTable({
    storageId: v.id("_storage"),
    workspaceId: v.id("workspaces"),
  }).index("by_storage", ["storageId"]),

  studies: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    audience: v.string(),
    goal: v.optional(v.string()),
    status: studyStatusValidator,
    tracks: v.array(v.string()),
    createdBy: v.id("users"),
    publishedAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
    // The seeded sample study; it never counts toward plan limits.
    isDemo: v.optional(v.boolean()),
    // Set while a permanent delete is purging the study's data in batches.
    deleting: v.optional(v.boolean()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  sources: defineTable({
    studyId: v.id("studies"),
    workspaceId: v.id("workspaces"),
    name: v.string(),
    kind: v.union(v.literal("file"), v.literal("paste")),
    storageId: v.optional(v.id("_storage")),
    text: v.string(),
    chars: v.number(),
  }).index("by_study", ["studyId"]),

  findings: defineTable({
    studyId: v.id("studies"),
    sourceId: v.id("sources"),
    chunkIndex: v.number(),
    type: findingTypeValidator,
    text: v.string(),
    speaker: v.optional(v.string()),
    number: v.optional(v.string()),
    label: v.optional(v.string()),
    strength: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_study_and_chunk", ["studyId", "chunkIndex"]),

  reels: defineTable({
    studyId: v.id("studies"),
    workspaceId: v.id("workspaces"),
    position: v.number(),
    track: v.string(),
    trackIndex: v.number(),
    title: v.string(),
    scenes: v.array(sceneValidator),
    findingIds: v.array(v.id("findings")),
    sourceNames: v.array(v.string()),
    warning: v.union(v.string(), v.null()),
    enabled: v.boolean(),
    // Optional observational clip played behind the reel's text.
    // `clipId` is set when the clip comes from the workspace's own uploads.
    footage: v.optional(
      v.object({
        url: v.string(),
        caption: v.string(),
        clipId: v.optional(v.id("footageClips")),
        // "image" = an AI-painted scene shown with slow camera movement; unset = video clip.
        media: v.optional(v.literal("image")),
        // Set when the reel owns the file (AI scenes), so it can be deleted when replaced.
        storageId: v.optional(v.id("_storage")),
      }),
    ),
    // AI scene generation in flight or failed; cleared once the scene is saved.
    art: v.optional(
      v.object({
        status: v.union(v.literal("pending"), v.literal("failed")),
        error: v.optional(v.string()),
      }),
    ),
  }).index("by_study_and_position", ["studyId", "position"])
    .index("by_workspace", ["workspaceId"]),

  // Video clips editors uploaded to use as reel backgrounds.
  footageClips: defineTable({
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    url: v.string(),
    name: v.string(),
    size: v.number(),
    uploadedBy: v.id("users"),
  }).index("by_workspace", ["workspaceId"]),

  generationJobs: defineTable({
    studyId: v.id("studies"),
    workspaceId: v.id("workspaces"),
    status: jobStatusValidator,
    phase: jobPhaseValidator,
    cursor: v.number(),
    chunks: v.array(chunkValidator),
    attempts: v.number(),
    log: v.array(logEntryValidator),
    lockedUntil: v.string(),
    error: v.optional(v.string()),
    // Technical detail behind `error`, shown in a collapsible section for troubleshooting.
    errorDetail: v.optional(v.string()),
    startedBy: v.id("users"),
  }).index("by_study", ["studyId"]),

  reactions: defineTable({
    reelId: v.id("reels"),
    studyId: v.id("studies"),
    userId: v.id("users"),
    kind: reactionKindValidator,
  })
    .index("by_reel_and_user", ["reelId", "userId"])
    .index("by_study", ["studyId"]),

  // View-only public links to a published study's feed.
  shareLinks: defineTable({
    studyId: v.id("studies"),
    workspaceId: v.id("workspaces"),
    token: v.string(),
    createdBy: v.id("users"),
    revoked: v.boolean(),
    // When true, guests on this link only see other guests' comments.
    hideTeamComments: v.optional(v.boolean()),
  })
    .index("by_token", ["token"])
    .index("by_study", ["studyId"]),

  // People who opened a share link and gave their name to interact.
  guests: defineTable({
    studyId: v.id("studies"),
    linkId: v.id("shareLinks"),
    name: v.string(),
    secret: v.string(),
  })
    .index("by_secret", ["secret"])
    .index("by_study", ["studyId"]),

  guestReactions: defineTable({
    reelId: v.id("reels"),
    studyId: v.id("studies"),
    guestId: v.id("guests"),
    kind: reactionKindValidator,
  })
    .index("by_reel_and_guest", ["reelId", "guestId"])
    .index("by_study", ["studyId"]),

  guestViews: defineTable({
    reelId: v.id("reels"),
    studyId: v.id("studies"),
    guestId: v.id("guests"),
    viewCount: v.number(),
    completed: v.boolean(),
    lastViewedAt: v.string(),
  })
    .index("by_reel_and_guest", ["reelId", "guestId"])
    .index("by_study", ["studyId"]),

  comments: defineTable({
    reelId: v.id("reels"),
    studyId: v.id("studies"),
    // Exactly one of userId (workspace member) or guestId (share-link viewer).
    userId: v.optional(v.id("users")),
    guestId: v.optional(v.id("guests")),
    parentId: v.optional(v.id("comments")),
    kind: commentKindValidator,
    body: v.string(),
    resolved: v.boolean(),
  })
    .index("by_reel", ["reelId"])
    .index("by_study", ["studyId"]),

  reelViews: defineTable({
    reelId: v.id("reels"),
    studyId: v.id("studies"),
    userId: v.id("users"),
    viewCount: v.number(),
    completed: v.boolean(),
    lastViewedAt: v.string(),
  })
    .index("by_reel_and_user", ["reelId", "userId"])
    .index("by_study", ["studyId"]),

  // A member's personal "Saved" list of reels, private to them.
  savedReels: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    reelId: v.id("reels"),
    studyId: v.id("studies"),
  })
    .index("by_user_and_workspace", ["userId", "workspaceId"])
    .index("by_reel_and_user", ["reelId", "userId"])
    .index("by_study", ["studyId"]),

  // Denormalized per-reel counts so the feed and insights avoid scanning
  // every reaction, comment and view row.
  reelCounters: defineTable({
    reelId: v.id("reels"),
    studyId: v.id("studies"),
    trueCount: v.number(),
    surprisedCount: v.number(),
    pushbackCount: v.number(),
    commentCount: v.number(),
    openCount: v.number(),
    // Guest-only comment totals, shown on share links that hide team comments.
    guestCommentCount: v.optional(v.number()),
    guestOpenCount: v.optional(v.number()),
    views: v.number(),
    viewers: v.number(),
    completions: v.number(),
  })
    .index("by_reel", ["reelId"])
    .index("by_study", ["studyId"]),

  // AI-written readout decks built from Insights data.
  decks: defineTable({
    workspaceId: v.id("workspaces"),
    // "all" when the deck covers every published study.
    scope: v.union(v.id("studies"), v.literal("all")),
    scopeLabel: v.string(),
    createdBy: v.id("users"),
    slides: v.array(deckSlideValidator),
    stats: deckStatsValidator,
    reels: v.array(deckReelValidator),
  }).index("by_workspace_and_scope", ["workspaceId", "scope"]),
});
