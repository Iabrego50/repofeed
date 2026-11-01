export type EmailPrefsRow = {
  newStudies: boolean;
  feedback: boolean;
};

export function defaultEmailPrefs(): EmailPrefsRow {
  return { newStudies: true, feedback: true };
}

export function resolveEmailPrefs(row: { new_studies?: boolean | null; feedback?: boolean | null } | null): EmailPrefsRow {
  return {
    newStudies: row?.new_studies ?? true,
    feedback: row?.feedback ?? true,
  };
}

export function isFirstPublish(publishedAt: string | null | undefined): boolean {
  return publishedAt == null;
}

export function feedbackKindLabel(kind: string): string {
  if (kind === "pushback") return "pushed back";
  if (kind === "question") return "asked a question";
  return "left a note";
}

export function shouldSendStudyPublished(args: {
  prefs: EmailPrefsRow;
  recipientUserId: string;
  publisherUserId: string;
  recipientEmail: string | null | undefined;
}): boolean {
  if (!args.recipientEmail) return false;
  if (args.recipientUserId === args.publisherUserId) return false;
  return args.prefs.newStudies;
}

export function shouldSendFeedback(args: {
  prefs: EmailPrefsRow;
  recipientEmail: string | null | undefined;
}): boolean {
  return Boolean(args.recipientEmail) && args.prefs.feedback;
}

export function settingsUrl(siteUrl: string, workspaceId: string): string {
  return `${siteUrl}/settings?ws=${encodeURIComponent(workspaceId)}`;
}

export function studyWatchUrl(siteUrl: string, studyId: string): string {
  return `${siteUrl}/feed?study=${studyId}`;
}
