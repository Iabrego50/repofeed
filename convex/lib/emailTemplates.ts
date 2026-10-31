import escapeHtml from "escape-html";

/** Public address of the app; buttons in emails open pages here. */
export const SITE_URL = "https://repofeed.ai";
/** Sender for update emails. Its domain must be verified in the Email tab. */
export const EMAIL_FROM = "repofeed.ai <no-reply@repofeed.ai>";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export type FeedbackKind = "pushback" | "question" | "action" | "note" | "reply";

const FEEDBACK_VERB: Record<FeedbackKind, string> = {
  pushback: "pushed back on",
  question: "asked a question on",
  action: "added an action item on",
  note: "commented on",
  reply: "replied to your comment on",
};

const settingsUrl = (workspaceId: string) => `${SITE_URL}/settings?ws=${encodeURIComponent(workspaceId)}`;

/** Subjects are plain text; collapse whitespace so a pasted title can't break the header. */
function oneLine(s: string, max = 120): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
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
    : "";
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

export function studyPublishedEmail(args: {
  to: string;
  workspaceId: string;
  workspaceName: string;
  studyId: string;
  studyTitle: string;
  publisherName: string;
  sceneCount: number;
}): EmailMessage {
  const url = `${SITE_URL}/feed?study=${encodeURIComponent(args.studyId)}&ws=${encodeURIComponent(args.workspaceId)}`;
  const scenes = `${args.sceneCount} ${args.sceneCount === 1 ? "scene is" : "scenes are"}`;
  const heading = `New study: ${args.studyTitle}`;
  const intro = `${args.publisherName} just published "${args.studyTitle}" in ${args.workspaceName}. ${scenes} ready to watch in your feed.`;
  const footer = `You're getting this because you're in ${args.workspaceName} on repofeed.ai.`;
  return {
    to: args.to,
    subject: oneLine(`New study in ${args.workspaceName}: ${args.studyTitle}`),
    html: layout({ heading, intro, cta: { label: "Watch the scenes", url }, footer, workspaceId: args.workspaceId }),
    text: `${heading}\n\n${intro}\n\nWatch the scenes: ${url}\n\n${footer} Turn these emails off in Settings: ${settingsUrl(args.workspaceId)}`,
  };
}

export function feedbackEmail(args: {
  to: string;
  workspaceId: string;
  workspaceName: string;
  reelId: string;
  reelTitle: string;
  actorName: string;
  kind: FeedbackKind;
  body?: string;
}): EmailMessage {
  const url = `${SITE_URL}/feed?reel=${encodeURIComponent(args.reelId)}&ws=${encodeURIComponent(args.workspaceId)}`;
  const line = `${args.actorName} ${FEEDBACK_VERB[args.kind]} "${args.reelTitle}"`;
  const intro =
    args.kind === "pushback"
      ? `${line}. They doubt this finding or want more proof. Open the scene to see the discussion.`
      : `${line}.`;
  const quote = args.body ? oneLine(args.body, 600) : undefined;
  const footer = `You're getting this because you're involved in this scene in ${args.workspaceName}.`;
  return {
    to: args.to,
    subject: oneLine(line),
    html: layout({ heading: line, intro, quote, cta: { label: "Open the scene", url }, footer, workspaceId: args.workspaceId }),
    text: `${intro}${quote ? `\n\n"${quote}"` : ""}\n\nOpen the scene: ${url}\n\n${footer} Turn these emails off in Settings: ${settingsUrl(args.workspaceId)}`,
  };
}
