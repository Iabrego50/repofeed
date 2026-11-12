/** Public contact and legal details shown in the footer, legal pages and help menu. */
export const SUPPORT_EMAIL = "support@repofeed.ai";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const COMPANY_NAME = "repofeed.ai";
export const LEGAL_LAST_UPDATED = "November 9, 2026";

/**
 * TODO: replace LEGAL_ENTITY_NAME with the registered legal entity
 * (for example, "Example Research, Inc.") before taking paid customers.
 */
export const LEGAL_ENTITY_NAME = "repofeed.ai";

/**
 * TODO: replace LEGAL_ADDRESS with the registered business address
 * used on invoices and legal notices.
 */
export const LEGAL_ADDRESS = "repofeed.ai";

export const GOVERNING_LAW = "the State of Ohio";

/** Official public address. Used in email templates and share links. */
export const SITE_URL = "https://repofeed.ai";

/**
 * Base for links people copy and send to others (share and invite links).
 * The live app always uses repofeed.ai; the editor preview keeps its own
 * address so links can be tested against the preview data.
 */
export const SHAREABLE_ORIGIN = import.meta.env.PROD ? SITE_URL : window.location.origin;
