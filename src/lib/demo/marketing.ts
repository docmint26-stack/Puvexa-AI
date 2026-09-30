export const landingStats = [
  { label: "Problems diagnosed", value: 40000 },
  { label: "Problems solved", value: 2500, suffix: "+" },
  { label: "Verified fixes", value: 2000 },
  { label: "Contributors", value: 8700 },
];

export const howItWorksSteps = [
  {
    step: "01",
    title: "Describe the problem",
    description:
      "Type what happened, paste logs, or drop a screenshot. Puvexa reads the context automatically.",
    icon: "upload",
  },
  {
    step: "02",
    title: "AI matches similar cases",
    description:
      "Your exact environment, error signature, and config are mapped to thousands of solved cases.",
    icon: "cpu",
  },
  {
    step: "03",
    title: "Fixes are ranked",
    description:
      "Every fix is ranked by measured success rate, confidence, effort, and risk for your case.",
    icon: "list-ordered",
  },
  {
    step: "04",
    title: "Outcome is verified",
    description:
      "Results are verified with evidence before a fix ever becomes a trusted contribution.",
    icon: "shield-check",
  },
  {
    step: "05",
    title: "Contributors earn FIX",
    description:
      "Verified, useful fixes earn FIX — plus royalties every time the fix is reused.",
    icon: "coins",
  },
] as const;

export const features = [
  {
    title: "Context-Aware Diagnosis",
    description:
      "Puvexa reads your logs, environment, and stack so answers match your exact setup — not generic advice.",
    icon: "scan-search",
  },
  {
    title: "Similar Verified Cases",
    description:
      "Instantly see how thousands of people solved the same problem — with evidence, not upvotes.",
    icon: "files",
  },
  {
    title: "High-Confidence Fix Ranking",
    description:
      "Fixes are ranked by measured success rate, effort, and risk. The #1 fix is the one most likely to work.",
    icon: "list-ordered",
  },
  {
    title: "Outcome Verification",
    description:
      "Every solution passes evidence-backed verification before it earns trust — or tokens.",
    icon: "shield-check",
  },
  {
    title: "Continuous Learning",
    description:
      "Each verified outcome makes future recommendations smarter. Useful fixes compound across the network.",
    icon: "brain",
  },
  {
    title: "Knowledge Royalty",
    description:
      "When your verified fix is reused, you earn FIX royalties — knowledge that keeps paying you.",
    icon: "coins",
  },
] as const;

export const testimonials = [
  {
    quote:
      "I stopped guessing between five possible fixes. The rank list tells me which one works for my exact Windows build and my fix keeps paying royalties.",
    name: "Maya Chen",
    role: "Python Developer",
    handle: "@mayabuilds",
    initials: "MC",
    earned: "4,290 FIX",
  },
  {
    quote:
      "I contributed a driver rollback in January and it's still being reused. Puvexa turned 'helping people' into a measurable income stream.",
    name: "Daniel Kim",
    role: "Systems Engineer",
    handle: "@danielkim",
    initials: "DK",
    earned: "3,810 FIX",
  },
  {
    quote:
      "The confidence scores are the killer feature — no more copy-pasting Stack Overflow answers that don't match your environment.",
    name: "Sofia Rossi",
    role: "Full-Stack Developer",
    handle: "@sofiarossi",
    initials: "SR",
    earned: "3,340 FIX",
  },
];

export const tokenEconomy = [
  {
    title: "Earn",
    description: "Submit verified, useful fixes and earn FIX for every accepted contribution.",
    icon: "coins",
    points: ["Fix rewards per verified solution", "Bonus for first-week fix quality"],
  },
  {
    title: "Spend",
    description: "Use FIX for advanced diagnosis, deep analysis, and premium high-confidence answers.",
    icon: "zap",
    points: ["Premium expert diagnosis", "Priority verification pipeline"],
  },
  {
    title: "Stake",
    description: "Stake FIX behind a high-value contribution to signal confidence and share the outcome.",
    icon: "vault",
    points: ["Verification participation rewards", "Program yield on staked FIX"],
  },
  {
    title: "Royalties",
    description: "When your verified fix is reused by others, you earn recurring FIX royalties.",
    icon: "trending-up",
    points: ["Per-reuse royalty streams", "Lifetime attribution"],
  },
] as const;

export const heroRotating = [
  "Understand the problem.",
  "Find what actually worked.",
  "Verify the outcome.",
  "Reward useful knowledge.",
];

export const intelligencePhrases = [
  "37 people benefited from your contributed fixes.",
  "Your knowledge earned 14 FIX this week.",
  "2 outcomes are waiting for verification.",
];
