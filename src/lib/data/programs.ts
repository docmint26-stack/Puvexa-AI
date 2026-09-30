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
    title: "Ambassador Program",
    tagline: "Champion Puvexa at your university",
    description:
      "Lead a technical community — host workshops, help people diagnose and fix real problems, and grow the Puvexa network.",
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
];
