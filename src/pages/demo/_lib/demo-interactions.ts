import type { Comment, FeedReel, Finding } from "@/lib/api/mappers.ts";
import type { CommentKind } from "@/schema/validators.ts";
import type { ReelData } from "@/lib/reel/painter.ts";
import { DEMO_REELS, DEMO_TRACKS } from "./demo-reels.ts";
import { SAMPLE_STUDY } from "./sample.ts";
import { DEMO_SEEDED_COMMENTS, DEMO_SEED_HEARTS } from "./demo-comments.ts";

export const VISITOR_NAME = "You";
export const HINT_STORAGE_KEY = "repofeed.demo.interactHints";

export type DemoSceneState = {
  hearted: boolean;
  hearts: number;
  saved: boolean;
  comments: Comment[];
};

export type DemoInteractionState = Record<string, DemoSceneState>;

export type DemoReel = ReelData & {
  id: string;
  key: string;
  sources: string[];
  quotes: number;
  findings: Finding[];
};

let localCommentSeq = 0;

export function demoReelId(index: number): string {
  return `demo-${index}`;
}

export function buildDemoReels(): DemoReel[] {
  return DEMO_REELS.map((r, i) => {
    const id = demoReelId(i);
    const sources = [...new Set(r.findings.map((f) => f.file))];
    return {
      id,
      key: r.title,
      title: r.title,
      track: DEMO_TRACKS[r.track],
      trackIndex: r.track,
      studyTitle: SAMPLE_STUDY.title,
      scenes: r.scenes,
      footage: r.footage,
      sources,
      quotes: r.findings.length,
      findings: r.findings.map((f, fi) => ({
        _id: `${id}-f-${fi}`,
        id: `${id}-f-${fi}`,
        _creationTime: 0,
        studyId: "demo",
        type: f.type,
        text: f.text,
        speaker: f.speaker,
        number: f.number,
        label: f.label,
        createdAt: "",
      })),
    };
  });
}

export function initialInteractionState(
  reels: DemoReel[],
): DemoInteractionState {
  const state: DemoInteractionState = {};
  for (const [i, reel] of reels.entries()) {
    state[reel.id] = {
      hearted: false,
      hearts: DEMO_SEED_HEARTS[i] ?? 0,
      saved: false,
      comments: (DEMO_SEEDED_COMMENTS[reel.id] ?? []).map((c) => ({ ...c })),
    };
  }
  return state;
}

export function toggleHeart(
  state: DemoInteractionState,
  reelId: string,
): DemoInteractionState {
  const scene = state[reelId];
  if (!scene) return state;
  const hearted = !scene.hearted;
  return {
    ...state,
    [reelId]: {
      ...scene,
      hearted,
      hearts: Math.max(0, scene.hearts + (hearted ? 1 : -1)),
    },
  };
}

export function toggleSave(
  state: DemoInteractionState,
  reelId: string,
): DemoInteractionState {
  const scene = state[reelId];
  if (!scene) return state;
  return {
    ...state,
    [reelId]: { ...scene, saved: !scene.saved },
  };
}

export function addLocalComment(
  state: DemoInteractionState,
  reelId: string,
  args: { kind: CommentKind; body: string; parentId?: string },
  now = Date.now(),
): DemoInteractionState {
  const scene = state[reelId];
  const body = args.body.trim();
  if (!scene || !body) return state;
  localCommentSeq += 1;
  const id = `you-${now}-${localCommentSeq}`;
  const comment: Comment = {
    _id: id,
    id,
    _creationTime: now,
    reelId,
    studyId: "demo",
    userId: null,
    guestId: "demo-visitor",
    parentId: args.parentId ?? null,
    kind: args.kind,
    body,
    resolved: false,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    author: { name: VISITOR_NAME },
  };
  return {
    ...state,
    [reelId]: { ...scene, comments: [comment, ...scene.comments] },
  };
}

export function toFeedReel(reel: DemoReel, scene: DemoSceneState): FeedReel {
  return {
    _id: reel.id,
    id: reel.id,
    _creationTime: 0,
    workspaceId: "demo",
    studyId: "demo",
    position: 0,
    track: reel.track,
    trackIndex: reel.trackIndex,
    title: reel.title,
    scenes: reel.scenes,
    sourceNames: reel.sources,
    footage: reel.footage,
    warning: null,
    enabled: true,
    createdAt: "",
    updatedAt: "",
    studyTitle: reel.studyTitle,
    saved: scene.saved,
    reactions: { heart: scene.hearts },
    commentCount: scene.comments.length,
    counts: { comments: scene.comments.length, reactions: scene.hearts },
  };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  const editable = target.getAttribute("contenteditable");
  return editable === "" || editable === "true";
}

export function readHintsDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistHintsDismissed(): void {
  try {
    localStorage.setItem(HINT_STORAGE_KEY, "1");
  } catch {
    // Ignore private-mode / unavailable storage.
  }
}
