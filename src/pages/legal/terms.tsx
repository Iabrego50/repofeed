import { COMPANY_NAME, GOVERNING_LAW, LEGAL_ADDRESS, LEGAL_ENTITY_NAME, SUPPORT_EMAIL } from "@/lib/site.ts";
import LegalPage, { type LegalSection } from "./_components/legal-page.tsx";

const SECTIONS: LegalSection[] = [
  {
    heading: "Using the service",
    paragraphs: [
      `${COMPANY_NAME} turns research files into short, cited insight scenes that your team can watch, react to and discuss. By creating an account, joining a workspace or opening a share link, you agree to these terms.`,
      "You must be at least 18, or the age of majority where you live, and able to enter a binding agreement. If you use the service on behalf of a company, you confirm you are allowed to accept these terms for it.",
    ],
  },
  {
    heading: "Accounts and workspaces",
    bullets: [
      "You are responsible for activity under your account and for keeping your sign-in details secure.",
      "Workspace owners control who is invited, each person's role, and the workspace's plan and billing.",
      "Anyone holding a share link can watch the scenes it includes. Turn a link off in the study's settings if it should no longer work.",
    ],
  },
  {
    heading: "Your content",
    paragraphs: [
      "You keep all rights to the research you add, including the text from your files, video clips, comments and anything generated from them. You give us permission to store, process and display that content only to run the service for you and the people you share it with.",
      "You confirm you have the right to use the research you add, including any consent needed from research participants, and that it doesn't break any law or anyone else's rights.",
    ],
  },
  {
    heading: "AI-generated content",
    paragraphs: [
      "Scenes, summaries and readout decks are written by AI from your files. We check quotes and numbers against your sources, but AI can still make mistakes. Review everything before you rely on it or share it, and use the evidence panel to confirm the source.",
    ],
  },
  {
    heading: "Acceptable use",
    paragraphs: ["You agree not to:"],
    bullets: [
      "Upload content that is illegal, harmful, or that you don't have the right to share.",
      "Try to break into, overload, copy or reverse-engineer the service.",
      "Use the service to send spam or to mislead people about where content came from.",
      "Resell or give access to the service except as your plan allows.",
    ],
  },
  {
    heading: "Plans, trials and billing",
    bullets: [
      "Paid plans are billed in advance, monthly or yearly, plus applicable tax. Team plans are billed per editor seat, with a minimum of 2 seats.",
      "Each person can use one 14-day free trial. Unless you cancel before the trial ends, your plan starts and your card is charged.",
      "You can cancel anytime from Plan and billing. Your plan stays active until the end of the period you have paid for. Except where the law requires, or as described in Help → Refunds, payments are not refunded.",
      "If a payment fails or a plan ends, the workspace moves to the Free plan's limits. Your studies are kept, but some features are paused until you restore a paid plan.",
      "We may change prices. We will give you at least 30 days' notice before a price change affects you.",
    ],
  },
  {
    heading: "Ending your use",
    paragraphs: [
      "You can stop using the service at any time. We may suspend or close accounts that break these terms or put the service or other users at risk. Where reasonable, we will tell you first and give you a chance to fix the problem.",
    ],
  },
  {
    heading: "Disclaimers and liability",
    paragraphs: [
      `The service is provided "as is" and "as available". To the fullest extent the law allows, ${COMPANY_NAME} makes no warranties beyond those in these terms. We are not liable for indirect or consequential losses, or for lost profits or data. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.`,
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      `These terms are an agreement with ${LEGAL_ENTITY_NAME}, ${LEGAL_ADDRESS}. They are governed by the laws of the United States and of ${GOVERNING_LAW}, without regard to conflict-of-law rules.`,
    ],
  },
  {
    heading: "Changes and contact",
    paragraphs: [
      `We may update these terms from time to time. If a change is significant, we will let you know in the app or by email before it takes effect. If you have questions, email us at ${SUPPORT_EMAIL}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms explain the rules for using ${COMPANY_NAME}, written as plainly as we can. Please read them along with our Privacy Policy.`}
      sections={SECTIONS}
    />
  );
}
