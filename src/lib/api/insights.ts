import { supabase } from '../supabase';

export interface ReelRow {
  reelId: string;
  studyId: string;
  studyTitle: string;
  title: string;
  track: string;
  views: number;
  viewers: number;
  completions: number;
  completionRate: number;
  teamViewers: number;
  teamCompletions: number;
  guestViewers: number;
  guestCompletions: number;
  trueCount: number;
  surprisedCount: number;
  pushbackCount: number;
  commentCount: number;
  openCount: number;
}

export interface InsightSummary {
  studies: Array<{ _id: string; title: string }>;
  reached: number;
  guestsReached: number;
  memberCount: number;
  totalViews: number;
  completionRate: number;
  teamCompletionRate: number;
  guestCompletionRate: number;
  reactions: {
    true: number;
    surprised: number;
    pushback: number;
  };
  openItems: number;
  rows: ReelRow[];
}

export interface Watcher {
  key: string;
  name: string;
  isGuest: boolean;
  completed: boolean;
  reaction: 'true' | 'surprised' | 'pushback' | null;
  lastViewedAt: string;
}

export interface ExportedComment {
  study: string;
  reel: string;
  kind: string;
  author: string;
  body: string;
  resolved: boolean;
  isReply: boolean;
  createdAt: string;
}

interface Tally {
  viewers: number;
  completions: number;
}

const EMPTY_TALLY: Tally = { viewers: 0, completions: 0 };

function tallyByReel(views: Array<{ reelId: string; completed: boolean }>): Map<string, Tally> {
  const out = new Map<string, Tally>();
  for (const v of views) {
    const t = out.get(v.reelId) ?? { viewers: 0, completions: 0 };
    t.viewers += 1;
    if (v.completed) t.completions += 1;
    out.set(v.reelId, t);
  }
  return out;
}

export async function summary({ workspaceId, studyId }: { workspaceId: string; studyId?: string }): Promise<InsightSummary> {
  // Get published studies in scope
  let studiesQuery = supabase
    .from('studies')
    .select('id, title, workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);

  if (studyId) {
    studiesQuery = studiesQuery.eq('id', studyId);
  }

  const { data: studies, error: studiesError } = await studiesQuery;
  if (studiesError) throw studiesError;
  if (!studies || studies.length === 0) {
    return {
      studies: [],
      reached: 0,
      guestsReached: 0,
      memberCount: 0,
      totalViews: 0,
      completionRate: 0,
      teamCompletionRate: 0,
      guestCompletionRate: 0,
      reactions: { true: 0, surprised: 0, pushback: 0 },
      openItems: 0,
      rows: [],
    };
  }

  // Get workspace members count
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId);
  if (membersError) throw membersError;

  const reached = new Set<string>();
  const guestsSeen = new Set<string>();
  const rows: ReelRow[] = [];

  for (const study of studies) {
    // Get reels for this study
    const { data: reels, error: reelsError } = await supabase
      .from('reels')
      .select('id, title, track, enabled')
      .eq('study_id', study.id)
      .eq('enabled', true)
      .order('position', { ascending: true })
      .limit(100);
    if (reelsError) throw reelsError;
    if (!reels || reels.length === 0) continue;

    const reelIds = (reels as any[]).map((r: any) => r.id);

    // Get counters for all reels
    const { data: counters, error: countersError } = await supabase
      .from('reel_counters')
      .select('reel_id, views, true_count, surprised_count, pushback_count, comment_count, open_count')
      .eq('study_id', study.id)
      .in('reel_id', reelIds);
    if (countersError) throw countersError;

    // Get views
    const { data: views, error: viewsError } = await supabase
      .from('reel_views')
      .select('reel_id, user_id, completed')
      .eq('study_id', study.id)
      .in('reel_id', reelIds);
    if (viewsError) throw viewsError;

    // Get guest views
    const { data: guestViews, error: guestViewsError } = await supabase
      .from('guest_views')
      .select('reel_id, guest_id, completed')
      .eq('study_id', study.id)
      .in('reel_id', reelIds);
    if (guestViewsError) throw guestViewsError;

    const viewsData = (views ?? []) as any[];
    const guestViewsData = (guestViews ?? []) as any[];
    
    const team = tallyByReel(viewsData.map((v: any) => ({ reelId: v.reel_id, completed: v.completed })));
    const guests = tallyByReel(guestViewsData.map((v: any) => ({ reelId: v.reel_id, completed: v.completed })));

    for (const vw of viewsData) reached.add(vw.user_id);
    for (const gv of guestViewsData) guestsSeen.add(gv.guest_id);

    const byReel = new Map(((counters ?? []) as any[]).map((c: any) => [c.reel_id, c]));

    for (const reel of (reels as any[])) {
      const c = byReel.get(reel.id);
      const t = team.get(reel.id) ?? EMPTY_TALLY;
      const g = guests.get(reel.id) ?? EMPTY_TALLY;
      const viewers = t.viewers + g.viewers;
      const completions = t.completions + g.completions;

      rows.push({
        reelId: reel.id,
        studyId: study.id,
        studyTitle: study.title,
        title: reel.title,
        track: reel.track,
        views: c?.views ?? 0,
        viewers,
        completions,
        completionRate: viewers ? completions / viewers : 0,
        teamViewers: t.viewers,
        teamCompletions: t.completions,
        guestViewers: g.viewers,
        guestCompletions: g.completions,
        trueCount: c?.true_count ?? 0,
        surprisedCount: c?.surprised_count ?? 0,
        pushbackCount: c?.pushback_count ?? 0,
        commentCount: c?.comment_count ?? 0,
        openCount: c?.open_count ?? 0,
      });
    }
  }

  const sum = (k: keyof Pick<ReelRow, 'views' | 'viewers' | 'completions' | 'teamViewers' | 'teamCompletions' | 'guestViewers' | 'guestCompletions' | 'trueCount' | 'surprisedCount' | 'pushbackCount' | 'commentCount' | 'openCount'>) =>
    rows.reduce((n, r) => n + r[k], 0);
  const rate = (done: number, of: number) => (of ? done / of : 0);

  return {
    studies: studies.map(s => ({ _id: s.id, title: s.title })),
    reached: reached.size,
    guestsReached: guestsSeen.size,
    memberCount: members?.length ?? 0,
    totalViews: sum('views'),
    completionRate: rate(sum('completions'), sum('viewers')),
    teamCompletionRate: rate(sum('teamCompletions'), sum('teamViewers')),
    guestCompletionRate: rate(sum('guestCompletions'), sum('guestViewers')),
    reactions: {
      true: sum('trueCount'),
      surprised: sum('surprisedCount'),
      pushback: sum('pushbackCount'),
    },
    openItems: sum('openCount'),
    rows,
  };
}

export async function watchers({ reelId }: { reelId: string }): Promise<Watcher[]> {
  // Get the reel to check workspace
  const { data: reel, error: reelError } = await supabase
    .from('reels')
    .select('workspace_id')
    .eq('id', reelId)
    .single();
  if (reelError) throw reelError;
  if (!reel) return [];

  // Get team views with joined user data
  const { data: views, error: viewsError } = await supabase
    .from('reel_views')
    .select('id, user_id, completed, last_viewed_at')
    .eq('reel_id', reelId)
    .limit(200);
  if (viewsError) throw viewsError;

  // Get guest views with joined guest data
  const { data: guestViews, error: guestViewsError } = await supabase
    .from('guest_views')
    .select('id, guest_id, completed, last_viewed_at')
    .eq('reel_id', reelId)
    .limit(200);
  if (guestViewsError) throw guestViewsError;

  const team: Watcher[] = [];
  for (const vw of (views ?? []) as any[]) {
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', vw.user_id)
      .maybeSingle();

    const { data: reaction } = await supabase
      .from('reactions')
      .select('kind')
      .eq('reel_id', reelId)
      .eq('user_id', vw.user_id)
      .maybeSingle();

    team.push({
      key: vw.id,
      name: user?.name ?? user?.email ?? 'Someone',
      isGuest: false,
      completed: vw.completed,
      reaction: (reaction as any)?.kind ?? null,
      lastViewedAt: vw.last_viewed_at,
    });
  }

  const guests: Watcher[] = [];
  for (const gv of (guestViews ?? []) as any[]) {
    const { data: guest } = await supabase
      .from('guests')
      .select('name')
      .eq('id', gv.guest_id)
      .maybeSingle();

    const { data: reaction } = await supabase
      .from('guest_reactions')
      .select('kind')
      .eq('reel_id', reelId)
      .eq('guest_id', gv.guest_id)
      .maybeSingle();

    guests.push({
      key: gv.id,
      name: guest?.name ?? 'Guest',
      isGuest: true,
      completed: gv.completed,
      reaction: (reaction as any)?.kind ?? null,
      lastViewedAt: gv.last_viewed_at,
    });
  }

  return [...team, ...guests].sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt));
}

export async function exportComments({ workspaceId, studyId }: { workspaceId: string; studyId?: string }): Promise<ExportedComment[]> {
  // Get published studies in scope
  let studiesQuery = supabase
    .from('studies')
    .select('id, title')
    .eq('workspace_id', workspaceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);

  if (studyId) {
    studiesQuery = studiesQuery.eq('id', studyId);
  }

  const { data: studies, error: studiesError } = await studiesQuery;
  if (studiesError) throw studiesError;
  if (!studies || studies.length === 0) return [];

  const out: ExportedComment[] = [];

  for (const study of (studies as any[])) {
    // Get reels for this study
    const { data: reels, error: reelsError } = await supabase
      .from('reels')
      .select('id, title')
      .eq('study_id', study.id)
      .limit(100);
    if (reelsError) throw reelsError;
    if (!reels) continue;

    const titles = new Map((reels as any[]).map((r: any) => [r.id, r.title]));
    const reelIds = (reels as any[]).map((r: any) => r.id);

    // Get comments for this study
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .eq('study_id', study.id)
      .in('reel_id', reelIds)
      .limit(5000);
    if (commentsError) throw commentsError;
    if (!comments) continue;

    for (const c of (comments as any[])) {
      let author = 'Unknown';
      if (c.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', c.user_id)
          .maybeSingle();
        author = user?.name ?? user?.email ?? 'Unknown';
      } else if (c.guest_id) {
        const { data: guest } = await supabase
          .from('guests')
          .select('name')
          .eq('id', c.guest_id)
          .maybeSingle();
        author = guest ? `${guest.name} (guest)` : 'Guest';
      }

      out.push({
        study: study.title,
        reel: titles.get(c.reel_id) ?? '',
        kind: c.kind,
        author,
        body: c.body,
        resolved: c.resolved,
        isReply: c.parent_id !== null,
        createdAt: new Date(c.created_at).toISOString(),
      });
    }
  }

  return out;
}
