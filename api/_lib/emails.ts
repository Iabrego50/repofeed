import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';
import {
  feedbackKindLabel,
  isFirstPublish,
  resolveEmailPrefs,
  settingsUrl,
  shouldSendFeedback,
  shouldSendStudyPublished,
  studyWatchUrl,
} from '@/lib/api/email-notify';

export {
  feedbackKindLabel,
  isFirstPublish,
  resolveEmailPrefs,
  settingsUrl,
  shouldSendFeedback,
  shouldSendStudyPublished,
  studyWatchUrl,
};

const resend = new Resend(process.env.RESEND_API_KEY);

export const SITE_URL = process.env.SITE_URL || 'https://repofeed.ai';
export const EMAIL_FROM = 'repofeed.ai <no-reply@repofeed.ai>';

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
  const settingsHref = settingsUrl(SITE_URL, opts.workspaceId);
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
<tr><td style="padding:20px 24px 24px;font-size:12px;line-height:1.5;color:#7a8599">${escapeHtml(opts.footer)} <a href="${escapeHtml(settingsHref)}" style="color:#2f7fd6">Turn these emails off in Settings</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

async function getEmailPrefs(workspaceId: string, userId: string) {
  const { data } = await supabase
    .from('email_prefs')
    .select('new_studies, feedback')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();
  
  return resolveEmailPrefs(data);
}

export async function sendStudyPublishedEmail(args: {
  workspaceId: string;
  studyId: string;
  studyTitle: string;
  authorName: string;
  publisherUserId?: string;
  publishedAt?: string | null;
}) {
  if (args.publishedAt !== undefined && !isFirstPublish(args.publishedAt)) return;

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, users(email)')
    .eq('workspace_id', args.workspaceId);

  if (!members) return;

  for (const member of members) {
    const email = Array.isArray(member.users) ? member.users[0]?.email : member.users?.email;
    const prefs = await getEmailPrefs(args.workspaceId, member.user_id);
    if (!shouldSendStudyPublished({
      prefs,
      recipientUserId: member.user_id,
      publisherUserId: args.publisherUserId ?? '',
      recipientEmail: email,
    })) continue;

    const html = layout({
      heading: `${args.authorName} published ${args.studyTitle}`,
      intro: 'New research insights are ready to watch.',
      cta: {
        label: 'Watch now',
        url: studyWatchUrl(SITE_URL, args.studyId),
      },
      footer: 'This study was just published in your workspace.',
      workspaceId: args.workspaceId,
    });

    await resend.emails.send({
      from: EMAIL_FROM,
      to: email!,
      subject: `${args.authorName} published ${args.studyTitle}`,
      html,
    });
  }
}

export async function sendFeedbackEmail(args: {
  workspaceId: string;
  reelId: string;
  reelTitle: string;
  commenterName: string;
  commentKind: string;
  commentBody: string;
  recipientUserId: string;
}) {
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', args.recipientUserId)
    .single();

  const prefs = await getEmailPrefs(args.workspaceId, args.recipientUserId);
  if (!shouldSendFeedback({ prefs, recipientEmail: user?.email })) return;

  const kindLabel = feedbackKindLabel(args.commentKind);

  const html = layout({
    heading: `${args.commenterName} ${kindLabel} on ${args.reelTitle}`,
    intro: `Someone responded to your work.`,
    quote: args.commentBody,
    cta: {
      label: 'View conversation',
      url: `${SITE_URL}/feed?reel=${args.reelId}`,
    },
    footer: 'You received this because you created this scene or commented on it.',
    workspaceId: args.workspaceId,
  });

  const to = user?.email;
  if (!to) return;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `${args.commenterName} ${kindLabel}`,
    html,
  });
}
