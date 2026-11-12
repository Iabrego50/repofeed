/**
 * The guided tour: three short lessons, one offered per visit, so a new editor
 * meets the app a few stops at a time over their first few sign-ins.
 *
 * Everything here is plain data and pure functions. The component in
 * `components/guide` draws it; this file decides what to show and when.
 */

export type GuideStop = {
  id: string;
  /** Where the stop lives. `study` is replaced with a published study when the workspace has one. */
  route: string;
  /** Matches a `data-tour` attribute. If nothing visible matches, the card is centred on screen. */
  target: string;
  title: string;
  body: string;
};

export type GuideLesson = { id: string; title: string; blurb: string; stops: GuideStop[] };

export const LESSONS: GuideLesson[] = [
  {
    id: "basics",
    title: "The basics",
    blurb: "Where your research lives and how to add the first study.",
    stops: [
      {
        id: "feed",
        route: "/",
        target: "nav-feed",
        title: "The feed is what your team sees",
        body: "Every study you publish lands here as short scenes, newest and unwatched first. For most of your team this is the whole product: they open it and scroll.",
      },
      {
        id: "studies",
        route: "/studies",
        target: "nav-studies",
        title: "A study is one research project",
        body: "Its files, its scenes and its share link stay together. Drafts are private to editors until you publish.",
      },
      {
        id: "new-study",
        route: "/studies",
        target: "new-study",
        title: "Start with research you’ve already finished",
        body: "Add the files, say who the findings are for, then review each scene before anyone else sees it. Files are read on your computer and only the text is sent.",
      },
      {
        id: "explore",
        route: "/explore",
        target: "nav-explore",
        title: "Ask your research a question",
        body: "Explore sorts every insight by topic. Type a word to filter, or ask a question in plain words and get a short answer that cites the insights it came from. ⌘K searches from anywhere.",
      },
    ],
  },
  {
    id: "share",
    title: "Share and discuss",
    blurb: "Getting a study in front of people, and what they can do with it.",
    stops: [
      {
        id: "share-link",
        route: "study",
        target: "share-link",
        title: "One private link per study",
        body: "Once a study is published, its Review tab has a share link. People outside the workspace open it, type their name the first time they react, and start watching. No account.",
      },
      {
        id: "reactions",
        route: "/",
        target: "reactions",
        title: "Three ways to answer a finding",
        body: "Rings true, Surprised me and Push back. They take one tap, and they tell you which findings are accepted and which you’ll need to defend.",
      },
      {
        id: "discussion",
        route: "/",
        target: "scene-actions",
        title: "Questions and action items stay on the scene",
        body: "Comments can be a note, a question or an action. Sources opens the exact quote and file behind the scene, so nobody has to take your word for it.",
      },
      {
        id: "invite",
        route: "/settings",
        target: "nav-settings",
        title: "Bring in the team",
        body: "Invite teammates here. Viewers are free on every plan and see each published study in their feed. Editors can make studies.",
      },
    ],
  },
  {
    id: "measure",
    title: "Measure and present",
    blurb: "Finding out whether the research landed, and turning it into slides.",
    stops: [
      {
        id: "insights",
        route: "/insights",
        target: "nav-insights",
        title: "See whether it was watched",
        body: "Insights shows who watched, who made it to the end, and which scenes drew pushback. Filter by study, or split team from guests.",
      },
      {
        id: "deck",
        route: "/insights",
        target: "nav-insights-deck",
        title: "A readout deck from the same findings",
        body: "Generate a short deck: findings, the quote or figure behind each, and recommendations. Present it in the browser or download it as PowerPoint and edit it.",
      },
      {
        id: "plan",
        route: "/billing",
        target: "nav-billing",
        title: "You pay for editors only",
        body: "Free covers three active studies and unlimited viewers. Upgrade when you need more studies or a second editor.",
      },
    ],
  },
];

export type GuideState = {
  /** Number of separate visits (browser sessions) in which the app was opened. */
  visits: number;
  /** Lesson ids finished or skipped. */
  done: string[];
  /** True once the person has turned the guide off. They can restart it from the sidebar. */
  off: boolean;
};

export const EMPTY_GUIDE: GuideState = { visits: 0, done: [], off: false };

/**
 * The lesson to offer now, or null. Lesson N unlocks on visit N, so nobody is
 * walked through twelve stops on day one.
 */
export function lessonToOffer(state: GuideState): GuideLesson | null {
  if (state.off) return null;
  const index = LESSONS.findIndex((lesson) => !state.done.includes(lesson.id));
  if (index === -1 || index + 1 > Math.max(1, state.visits)) return null;
  return LESSONS[index];
}

export function finishLesson(state: GuideState, lessonId: string): GuideState {
  return state.done.includes(lessonId) ? state : { ...state, done: [...state.done, lessonId] };
}

export function nextLessonAfter(lessonId: string): GuideLesson | null {
  const index = LESSONS.findIndex((lesson) => lesson.id === lessonId);
  return index >= 0 ? (LESSONS[index + 1] ?? null) : null;
}

export function resolveRoute(stop: GuideStop, publishedStudyId: string | null): string {
  if (stop.route !== "study") return stop.route;
  return publishedStudyId ? `/studies/${publishedStudyId}?step=review` : "/studies";
}

const key = (userId: string) => `repofeed.guide.${userId}`;
const VISIT_FLAG = "repofeed.guide.visit";

export function readGuide(userId: string): GuideState {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return EMPTY_GUIDE;
    const parsed = JSON.parse(raw) as Partial<GuideState>;
    return {
      visits: Number.isFinite(parsed.visits) ? Number(parsed.visits) : 0,
      done: Array.isArray(parsed.done) ? parsed.done.filter((id): id is string => typeof id === "string") : [],
      off: Boolean(parsed.off),
    };
  } catch {
    return EMPTY_GUIDE;
  }
}

export function writeGuide(userId: string, state: GuideState): void {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    // Private windows can refuse storage. The guide then simply starts over next time.
  }
}

/** Counts this browser session as a visit, once. Returns the up-to-date state. */
export function registerVisit(userId: string): GuideState {
  const state = readGuide(userId);
  try {
    if (window.sessionStorage.getItem(VISIT_FLAG) === userId) return state;
    window.sessionStorage.setItem(VISIT_FLAG, userId);
  } catch {
    return state.visits > 0 ? state : { ...state, visits: 1 };
  }
  const next = { ...state, visits: state.visits + 1 };
  writeGuide(userId, next);
  return next;
}
