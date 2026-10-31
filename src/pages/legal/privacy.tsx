import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/site.ts";
import LegalPage, { type LegalSection } from "./_components/legal-page.tsx";

const SECTIONS: LegalSection[] = [
  {
    heading: "Your research files stay on your computer",
    paragraphs: [
      "When you add a PDF, Word document, slide deck, spreadsheet or text file, your browser reads it on your own device. The original file is never uploaded. We receive and store only the text inside it, which we need to build your scenes.",
    ],
  },
  {
    heading: "What we collect",
    bullets: [
      "Account details: your name, email address and profile picture, provided when you sign in.",
      "Research text: the words taken from files you add, plus any text you paste in.",
      "Video clips: footage that an editor chooses to upload. These are stored so everyone in the workspace can watch them.",
      "Activity: the scenes you watch, your reactions, comments, saved scenes and search use. This powers the feed and the Insights page.",
      "Share-link viewers: the name a viewer enters when they react or comment. Viewers who only watch don't need to give a name.",
      "Billing: your plan and payment status. Card details are handled by our payment processor. We never see or store your full card number.",
    ],
  },
  {
    heading: "How we use it",
    bullets: [
      "To create, check and show your scenes, readout decks and Insights.",
      "To run your workspace, including invites, roles, sharing and billing.",
      "To keep the service secure and to prevent abuse.",
      "To answer you when you contact support.",
    ],
    paragraphs: ["We do not sell your data. We do not use your research to train AI models of our own."],
  },
  {
    heading: "Who we share it with",
    paragraphs: [
      "We share data only with the service providers that help us run the app: hosting and database, sign-in, payments, and the AI providers that write scenes from your research text. They may use it only to provide their service to us. People in your workspace, and anyone you send a share link to, can see the content you share with them.",
      "We may disclose information if the law requires it, or to protect the safety of our users or the public.",
    ],
  },
  {
    heading: "Stored on your device",
    paragraphs: [
      "We save a few small settings in your browser, such as your sign-in, the workspace you last used and whether you have seen the tour. These are needed for the app to work. We do not use advertising cookies.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "We keep your content for as long as your workspace exists. When you delete a study, we remove its text, scenes and related activity. If you would like your account or workspace deleted, email us and we will remove it, except for records we must keep by law, such as invoices.",
    ],
  },
  {
    heading: "Your choices and rights",
    paragraphs: [
      `You can ask to see, correct, export or delete your personal information. Depending on where you live, for example in California, you may have additional rights. We will not treat you differently for using them. To make a request, email ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    heading: "Security",
    paragraphs: [
      "Data is encrypted while it travels and is kept on secured infrastructure. Access is limited to the people in your workspace. No system is perfectly secure, so if we learn of a breach that affects you, we will let you know.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [`${COMPANY_NAME} is a work tool and isn't meant for anyone under 18.`],
  },
  {
    heading: "Changes and contact",
    paragraphs: [
      `If this policy changes in a significant way, we will tell you in the app or by email. If you have questions, email us at ${SUPPORT_EMAIL}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`Your research is often confidential, so we collect as little as we can. This page explains what ${COMPANY_NAME} collects, why, and the choices you have.`}
      sections={SECTIONS}
    />
  );
}
