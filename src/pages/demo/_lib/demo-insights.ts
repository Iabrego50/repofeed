import { DEMO_REELS, DEMO_TRACKS } from "./demo-reels.ts";
import { SAMPLE_STUDY } from "./sample.ts";
import type { DashboardRow, DashboardSummary } from "@/pages/insights/_lib/columns.ts";

/** Sample team size for the made-up Supperly workspace. */
const MEMBERS = 14;
const TEAM_REACHED = 12;
const GUESTS_REACHED = 7;

// Per scene: team viewers, team finished, guest viewers, guest finished, plays, rings true, surprised, push back, comments, open.
const NUMBERS: Array<[number, number, number, number, number, number, number, number, number, number]> = [
  [12, 11, 7, 6, 31, 9, 4, 2, 6, 2],
  [11, 9, 5, 4, 24, 8, 2, 1, 3, 0],
  [11, 10, 6, 5, 22, 4, 7, 1, 4, 1],
  [10, 9, 4, 4, 19, 7, 3, 0, 5, 3],
  [10, 7, 4, 3, 17, 3, 2, 5, 7, 2],
  [9, 8, 3, 2, 15, 6, 5, 2, 2, 0],
  [9, 7, 3, 3, 14, 5, 1, 0, 3, 1],
  [9, 9, 5, 5, 18, 10, 6, 1, 8, 4],
  [8, 6, 2, 1, 12, 2, 3, 4, 4, 1],
  [8, 7, 2, 2, 11, 6, 1, 1, 2, 0],
];

export const DEMO_INSIGHT_ROWS: DashboardRow[] = DEMO_REELS.map((reel, i) => {
  const [tv, tc, gv, gc, views, t, s, p, comments, open] = NUMBERS[i % NUMBERS.length];
  const viewers = tv + gv;
  const completions = tc + gc;
  return {
    reelId: String(i),
    studyId: "demo",
    studyTitle: SAMPLE_STUDY.title,
    title: reel.title,
    track: DEMO_TRACKS[reel.track],
    views,
    viewers,
    completions,
    completionRate: completions / viewers,
    teamViewers: tv,
    teamCompletions: tc,
    guestViewers: gv,
    guestCompletions: gc,
    trueCount: t,
    surprisedCount: s,
    pushbackCount: p,
    commentCount: comments,
    openCount: open,
  };
});

function rate(rows: DashboardRow[], done: (r: DashboardRow) => number, of: (r: DashboardRow) => number) {
  const total = rows.reduce((n, r) => n + of(r), 0);
  return total ? rows.reduce((n, r) => n + done(r), 0) / total : 0;
}

const sum = (pick: (r: DashboardRow) => number) => DEMO_INSIGHT_ROWS.reduce((n, r) => n + pick(r), 0);

export const DEMO_INSIGHT_SUMMARY: DashboardSummary = {
  studies: [{ _id: "demo", title: SAMPLE_STUDY.title }],
  reached: TEAM_REACHED,
  guestsReached: GUESTS_REACHED,
  memberCount: MEMBERS,
  totalViews: sum((r) => r.views),
  completionRate: rate(DEMO_INSIGHT_ROWS, (r) => r.completions, (r) => r.viewers),
  teamCompletionRate: rate(DEMO_INSIGHT_ROWS, (r) => r.teamCompletions, (r) => r.teamViewers),
  guestCompletionRate: rate(DEMO_INSIGHT_ROWS, (r) => r.guestCompletions, (r) => r.guestViewers),
  reactions: {
    true: sum((r) => r.trueCount),
    surprised: sum((r) => r.surprisedCount),
    pushback: sum((r) => r.pushbackCount),
  },
  openItems: sum((r) => r.openCount),
  rows: DEMO_INSIGHT_ROWS,
};
