import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api.js";

export type FeedReel = FunctionReturnType<typeof api.feed.list>[number];
export type FeedComment = FunctionReturnType<typeof api.feed.comments>[number];
