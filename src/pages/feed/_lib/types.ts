// @ts-nocheck
import type { FunctionReturnType } from '@/convex/_generated/server';
import type { api } from "@/convex/_generated/api";

export type FeedReel = FunctionReturnType<typeof api.feed.list>[number];
export type FeedComment = FunctionReturnType<typeof api.feed.comments>[number];
