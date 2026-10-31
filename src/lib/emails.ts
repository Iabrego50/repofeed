import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const SITE_URL = process.env.VITE_SITE_URL || 'https://repofeed.ai';
export const EMAIL_FROM = 'repofeed.ai <no-reply@repofeed.ai>';

const settingsUrl = (workspaceId: string) =>
  `${SITE_URL}/settings?ws=${encodeURIComponent(workspaceId)}`;

function oneLine(s: string, max = 120): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function layout(opts: {
  heading: string;
  intro: string;
  quote?: string;
  cta: { label: string; url: string };
  footer: string;
  workspaceId: string;
}): string {
  const quote = opts.quote
    ? `<blockquote style="margin:20px 0;padding:12px 16px;border-left:3px solid #2f9bff;background:#f2f6fc;color:#1b2333;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(opts.quote)}</blockquote>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#eef2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b2333">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#070b14;padding:18px 24px;color:#eef3fb;font-weight:700;font-size:16px;letter-spacing:.2px">repofeed<span style="color:#2f9bff">.ai</span></td></tr>
<tr><td style="padding:28px 24px 8px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0b1220">${escapeHtml(opts.heading)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:#3a4558">${escapeHtml(opts.intro)}</p>
${quote}
<p style="margin:24px 0 8px"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:#2f9bff;color:#04101f;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(opts.cta.label)}</a></p>
</td></tr>
<tr><td style="padding:20px 24px 24px;font-size:12px;line-height:1.5;color:#7a8599">${escapeHtml(opts.footer)} <a href="${escapeHtml(settingsUrl(opts.workspaceId))}" style="color:#2f7fd6">Turn these emails off in Settings</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendStudyPublished(args: {
  to: string;
  workspaceId: string;
  workspaceName: string;
  studyId: string;
  studyTitle: string;
  publisherName: string;
  sceneCount: number;
}) {
  const url = `${SITE_URL}/feed?study=${encodeURIComponent(args.studyId)}&ws=${encodeURIComponent(args.workspaceId)}`;
  const scenes = `${args.sceneCount} ${args.sceneCount === 1 ? 'scene is' : 'scenes are'}`;
  const heading = `New study: ${args.studyTitle}`;
  const intro = `${args.publisherName} just published "${args.studyTitle}" in ${args.workspaceName}. ${scenes} ready to watch in your feed.`;
  const footer = `You're getting this because you're in ${args.workspaceName} on repofeed.ai.`;

  return resend.emails.send({
    from: EMAIL_FROM,
    to: args.to,
    subject: oneLine(`New study in ${args.workspaceName}: ${args.studyTitle}`),
    html: layout({
      heading,
      intro,
      cta: { label: 'Watch the scenes', url },
      footer,
      workspaceId: args.workspaceId,
    }),
  });
}

export async function sendFeedback(args: {
  to: string;
  workspaceId: string;
  workspaceName: string;
  reelId: string;
  reelTitle: string;
  actorName: string;
  kind: 'pushback' | 'question' | 'action' | 'note' | 'reply';
  body?: string;
}) {
  const FEEDBACK_VERB: Record<string, string> = {
    pushback: 'pushed back on',
    question: 'asked a question on',
    action: 'added an action item on',
    note: 'commented on',
    reply: 'replied to your comment on',
  };

  const url = `${SITE_URL}/feed?reel=${encodeURIComponent(args.reelId)}&ws=${encodeURIComponent(args.workspaceId)}`;
  const line = `${args.actorName} ${FEEDBACK_VERB[args.kind]} "${args.reelTitle}"`;
  const intro =
    args.kind === 'pushback'
      ? `${line}. They doubt this finding or want more proof. Open the scene to see the discussion.`
      : `${line}.`;
  const quote = args.body ? oneLine(args.body, 600) : undefined;
  const footer = `You're getting this because you're involved in this scene in ${args.workspaceName}.`;

  return resend.emails.send({
    from: EMAIL_FROM,
    to: args.to,
    subject: oneLine(line),
    html: layout({
      heading: line,
      intro,
      quote,
      cta: { label: 'Open the scene', url },
      footer,
      workspaceId: args.workspaceId,
    }),
  });
}

export async function sendWorkspaceInvite(args: {
  to: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  role: string;
}) {
  const url = `${SITE_URL}/workspace/${args.workspaceId}`;
  const heading = `You've been invited to ${args.workspaceName}`;
  const intro = `${args.inviterName} invited you to join ${args.workspaceName} as ${args.role === 'editor' ? 'an editor' : 'a member'}.`;
  const footer = 'Welcome to repofeed.ai!';

  return resend.emails.send({
    from: EMAIL_FROM,
    to: args.to,
    subject: oneLine(`Join ${args.workspaceName} on repofeed.ai`),
    html: layout({
      heading,
      intro,
      cta: { label: 'Accept invitation', url },
      footer,
      workspaceId: args.workspaceId,
    }),
  });
}
