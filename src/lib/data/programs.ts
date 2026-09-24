export type ProgramStatus = "open" | "coming-soon";

export interface Program {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  status: ProgramStatus;
  features: string[];
  cta: { label: string; href?: string };
  featured?: boolean;
}

// Homepage "Our Programs" list. Applications and availability are honest,
// front-facing copy — no financial or employment promises.
export const programs: Program[] = [
  {
    id: "campus-ambassador",
    title: "Campus Ambassador",
    tagline: "Champion Puvexa at your university",
    description:
      "Lead the technical community on your campus — host workshops, help students diagnose and fix real problems, and grow the Puvexa network.",
    icon: "graduation-cap",
    status: "open",
    features: [
      "Community & event leadership",
      "Public speaking and mentoring practice",
      "Certificate + priority product access",
    ],
    cta: { label: "Apply now", href: "/programs/campus-ambassador" },
    featured: true,
  },
  {
    id: "contributor",
    title: "Fixer Contributor",
    tagline: "Submit verified fixes that help the network",
    description:
      "Contribute evidence-backed fixes for the problems you solve. Useful contributions help other users — and build your on-chain reputation.",
    icon: "wrench",
    status: "open",
    features: [
      "Contribute fixes from your own cases",
      "Build verified on-chain credibility",
      "See your fix reuse across the network",
    ],
    cta: { label: "Start contributing", href: "/contribute" },
  },
  {
    id: "protege",
    title: "Protégé Program",
    tagline: "Learn from experienced fixers",
    description:
      "Get paired with an experienced Puvexa fixer for a structured learning path — from reading error signatures to publishing verified fixes.",
    icon: "sparkles",
    status: "coming-soon",
    features: [
      "Mentorship pairing",
      "Structured skill roadmap",
      "Guided verification-first projects",
    ],
    cta: { label: "Join the waitlist" },
  },
  {
    id: "creator",
    title: "Community Creator",
    tagline: "Teach problem-solving at scale",
    description:
      "Turn your verifications into tutorials, walkthroughs, and videos. Grow an audience while making the diagnosis library more useful.",
    icon: "video",
    status: "coming-soon",
    features: [
      "Content support & templates",
      "Community showcase",
      "Early access to new features",
    ],
    cta: { label: "Join the waitlist" },
  },
  {
    id: "qa",
    title: "Verification Network",
    tagline: "Help verify what actually works",
    description:
      "Join a distributed group that reviews claimed fixes for evidence quality — keeping high-confidence answers trustworthy for everyone.",
    icon: "shield-check",
    status: "coming-soon",
    features: [
      "Fix review & evidence checks",
      "Quality score contributions",
      "Network-level trust signals",
    ],
    cta: { label: "Join the waitlist" },
  },
];