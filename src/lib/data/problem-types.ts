// Shared types for the Puvexa Top 500 technical problem library.
//
// The canonical problem records are DISCOVERY SEEDS. They carry honest state
// fields (problemStatus / verificationSource) so the UI can never present a
// generated seed as a human-verified outcome.

/** Broad discovery filters shown in the UI (kept intentionally small). */
export type ProblemFilter =
  | "Coding"
  | "System"
  | "Network"
  | "Device"
  | "Productivity"
  | "Development Tools";

/** Display rows used by the homepage marquee (visual grouping only). */
export type ProblemRow =
  | "Coding & Development"
  | "Windows & Devices"
  | "Networking & Connectivity"
  | "Apps & Productivity";

export type ProblemDifficulty = "beginner" | "intermediate" | "advanced";

/**
 * Lifecycle of a problem record.
 * - SAMPLE: curated discovery seed (every generated record starts here)
 * - ACTIVE: a real diagnosis has been started against it
 * - SOLVED: a fix was reported to work
 * - VERIFIED: outcome evidence was confirmed by a human
 */
export type ProblemStatus = "SAMPLE" | "ACTIVE" | "SOLVED" | "VERIFIED";

/** Where verification evidence came from. NONE for pure discovery seeds. */
export type VerificationSource = "NONE" | "AI" | "HUMAN" | "COMMUNITY";

/** Fields authored per record in the raw catalog. */
export interface RawProblem {
  id: string;
  title: string;
  /** Optional override when a record needs technology/platform/difficulty beyond its section defaults. */
  platform?: string[];
  technologies?: string[];
  difficulty?: ProblemDifficulty;
  problemType?: string;
}

export interface ProblemSectionBase {
  /** 1–50 primary, 51–70 cross-topic. Stable ordering key. */
  index: number;
  slug: string;
  title: string;
  description: string;
  /** Canonical problem ids displayed by this section (exactly 10). */
  problemIds: string[];
}

/** A home section that owns its 10 canonical problems. */
export interface PrimaryProblemSection extends ProblemSectionBase {
  kind: "primary";
  filter: ProblemFilter;
  row: ProblemRow;
  primaryCategory: string;
  platform: string[];
  technologies: string[];
  problemType: string;
  difficulty: ProblemDifficulty;
  /** Extra search keywords for this problem family (symptoms, environments). */
  searchKeywords: string;
}

/**
 * A cross-topic section that REFERENCES 10 existing canonical problems.
 * References only — never duplicate records.
 */
export interface CrossProblemSection extends ProblemSectionBase {
  kind: "cross";
  /** Thematic label used for grouping in the explore UI. */
  theme: string;
}

export type ProblemSection = PrimaryProblemSection | CrossProblemSection;

/** Fully assembled canonical problem as consumed by the app. */
export interface CanonicalProblem {
  id: string;
  slug: string;
  title: string;
  primaryCategory: string;
  /** Slug of the owning primary section. */
  primarySection: string;
  /** Slugs of cross-topic sections that reference this problem. */
  secondarySections: string[];
  tags: string[];
  platform: string[];
  technologies: string[];
  difficulty: ProblemDifficulty;
  problemType: string;
  searchableText: string;
  /** True for curated discovery seeds (never presented as live user activity). */
  sample: boolean;
  problemStatus: ProblemStatus;
  verificationSource: VerificationSource;
  /** Curated initial ranking (1 = highest). Popularity data is added later. */
  curatedRank: number;
  filter: ProblemFilter;
  row: ProblemRow;
}
