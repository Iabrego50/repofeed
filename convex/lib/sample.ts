// Fictional Supperly sample study, shared by the demo seed and "Try sample files".

export const SAMPLE_FILES = [
  {
    name: "supperly-cancel-interviews.txt",
    text: `SUPPERLY MEAL KITS — CANCELLATION INTERVIEWS (FICTIONAL SAMPLE STUDY)
Method: 10 remote interviews, 30–45 min, August 2026, with customers who cancelled in the last 60 days. Supperly is a fictional meal-kit subscription. Names removed; descriptors only.

C1 — Parent of two, subscribed 7 months
"The box shows up Tuesday and by Thursday I'm staring at three bags of vegetables I feel guilty about."
"It stopped feeling like help and started feeling like homework."

C2 — Single professional, subscribed 3 months
"I skipped four weeks in a row and kept forgetting to skip the fifth. That's when I cancelled."
"The skip deadline is Wednesday at midnight. My life does not run on Wednesday at midnight."

C3 — Couple, both working, subscribed 11 months
"We loved the first month. By month six it was the same chicken with a different sauce."
"I'd pay more for fewer, better recipes."

C4 — Parent of three, subscribed 5 months
"My kids won't eat anything with a garnish on it. Half the recipes are for people without kids."
"The 30-minute meals take me 50. Every single time."

C5 — Retiree, subscribed 2 months
"The packaging made me feel terrible. A whole bin of cardboard and ice packs every week."

C6 — Student, subscribed 6 weeks (intro discount)
"I only signed up for the discount. When it went to full price it was more than my groceries."

C7 — Single parent, subscribed 9 months
"Cancelling took seven screens. It felt like they were hiding the button on purpose."
"If they'd just let me pause for a month I would have stayed."

C8 — Couple, subscribed 14 months
"Honestly the food was great. We cancelled because we moved and changing the address was a nightmare."

C9 — Young family, subscribed 4 months
"I want to cook three nights, not five. The smallest plan is still too much food."

C10 — Professional, subscribed 8 months
"The app never learned anything about me. I've rated forty meals and it still suggests mushrooms."

Researcher synthesis notes:
- 7 of 10 said the subscription began to feel like an obligation rather than help.
- 6 of 10 would have paused instead of cancelling if pausing were easier.
- 5 of 10 named recipe repetition as a reason they left.
- 4 of 10 said real cooking time was longer than the recipe card stated.
`,
  },
  {
    name: "supperly-churn-survey.csv",
    text: `question,response,n,percent,notes
"Main reason you cancelled (pick one)",Too expensive at full price,1140,29%,"Fictional sample data. Exit survey of cancelled subscribers, July–Aug 2026, n=1,140"
"Main reason you cancelled (pick one)",Too much food / wasted ingredients,1140,22%,
"Main reason you cancelled (pick one)",Recipes got repetitive,1140,17%,
"Main reason you cancelled (pick one)",Hard to skip or pause,1140,14%,
"Main reason you cancelled (pick one)",Took longer to cook than expected,1140,9%,
"Main reason you cancelled (pick one)",Packaging waste,1140,6%,
"Main reason you cancelled (pick one)",Other,1140,3%,
"Did you ever forget to skip a week you didn't want?",Yes,1140,46%,
"Would you have paused instead of cancelling if pausing were one tap?",Yes,1140,41%,
"How many nights a week do you want a kit for?",3 nights,1140,52%,
"How many nights a week do you want a kit for?",4 or more nights,1140,18%,
"How many nights a week do you want a kit for?",2 nights,1140,30%,
"Average actual cook time vs card time (self-reported)",Minutes over card time,1140,17,"minutes"
"Likely to return within 6 months",Yes,1140,33%,
"Months subscribed before cancelling (median)",Months,1140,4,"months"
`,
  },
  {
    name: "supperly-diary-study.md",
    text: `# Supperly — Two-week diary study notes (fictional sample study)

12 active-subscriber households, 2 weeks, September 2026. Daily photo + text entries via a diary app. 168 entries total.

## Week 1
- Delivery day entries were the most positive of the week in 10 of 12 households ("fun to unpack", "kids helped").
- By day 4, 8 of 12 households logged at least one kit meal swapped for takeout or leftovers.
- Recipe cards were photographed propped against coffee makers, taped to cabinets, and held by kids. 5 households cooked from their phone instead.
- Household 7: "I cooked the salmon on day 5 and it smelled like day 5."

## Week 2
- 9 of 12 households logged throwing away at least one ingredient.
- Most-wasted items: fresh herbs, half onions, the second avocado.
- Household 3 skipped a week on purpose and logged relief: "A week off feels like a vacation from my own fridge."
- Household 11 tried to change delivery day in the app and gave up after 10 minutes; called support.

## Patterns across 168 entries
- Kits cooked on the planned night: 61% of planned kit meals.
- Entries mentioning guilt (about waste, money, or uncooked kits): 38 of 168.
- Entries mentioning a child helping cook: 21 of 168, all positive.
- Most common unprompted wish: "fewer meals, more flexible days."
`,
  },
] as const;

export const SAMPLE_STUDY = {
  title: "Supperly Meal-Kit Cancellation Study",
  audience: "Product, growth and marketing leads",
  goal: "Why subscribers cancel, and which fixes would keep them",
};
