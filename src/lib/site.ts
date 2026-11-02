/** Public contact and legal details shown in the footer, legal pages and help menu. */
export const SUPPORT_EMAIL = "support@repofeed.ai";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const COMPANY_NAME = "repofeed.ai";
export const LEGAL_LAST_UPDATED = "October 30, 2026";

/** Official public address. Used in email templates and share links. */
export const SITE_URL = "https://repofeed.ai";

/**
 * Base for links people copy and send to others (share and invite links).
 * The live app always uses repofeed.ai; the editor preview keeps its own
 * address so links can be tested against the preview data.
 */
export const SHAREABLE_ORIGIN = import.meta.env.PROD ? SITE_URL : window.location.origin;
