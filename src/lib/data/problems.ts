// Puvexa Top 700 technical problem library — single source of truth.
//
// Assembles the raw catalog (problem-catalog.ts) with section defaults
// (problem-sections.ts) into canonical problem records, then exposes the
// search / filter / pagination / related-problem APIs used by the UI.
//
// Integrity rules:
// - 700 unique canonical records, PUV-0001 … PUV-0700.
// - Every record is a curated SAMPLE discovery seed: problemStatus "SAMPLE",
//   verificationSource "NONE". No fabricated search counts, success rates,
//   or human-verification claims exist anywhere in this dataset.
// - curatedRank is a curated initial ordering (commonness, usefulness,
//   diagnostic value, clarity, platform diversity, fix plurality). Real usage
//   metrics can replace it later without changing the record shape.

import { ALL_PROBLEM_SECTIONS, CROSS_SECTIONS, PRIMARY_SECTIONS } from "./problem-sections";
import { PROBLEM_CATALOG } from "./problem-catalog";
import type {
  CanonicalProblem,
  ProblemDifficulty,
  ProblemFilter,
  ProblemRow,
  ProblemSection,
  PrimaryProblemSection,
  RawProblem,
} from "./problem-types";

// ---------------------------------------------------------------------------
// UI constants (same broad filters the site already uses)
// ---------------------------------------------------------------------------

export const PROBLEM_FILTERS: ReadonlyArray<{ label: "All" | ProblemFilter; hint: string }> = [
  { label: "All", hint: "Everything Puvexa can help with" },
  { label: "Coding", hint: "Languages, frameworks, bugs" },
  { label: "System", hint: "Windows, macOS, Linux, storage, performance" },
  { label: "Network", hint: "Wi-Fi, Ethernet, VPN, DNS, printers" },
  { label: "Device", hint: "Laptops, desktops, hardware, peripherals" },
  { label: "Productivity", hint: "Office, browsers, Google Workspace" },
  { label: "Development Tools", hint: "VS Code, Git, Docker, Kubernetes, npm" },
];

export const PROBLEM_ROWS: ReadonlyArray<{ label: ProblemRow; icon: string; blurb: string }> = [
  {
    label: "Coding & Development",
    icon: "braces",
    blurb: "Bugs, builds, databases, and deployments",
  },
  {
    label: "Windows & Devices",
    icon: "monitor",
    blurb: "Operating systems, hardware, drivers, and performance",
  },
  {
    label: "Networking & Connectivity",
    icon: "wifi",
    blurb: "Wi-Fi, Bluetooth, printers, VPN, and network reachability",
  },
  {
    label: "Apps & Productivity",
    icon: "layout-grid",
    blurb: "Browsers, Office, Google Workspace, and everyday apps",
  },
];

export const PROBLEM_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Technology dictionary (used for derived tags + related-problem scoring)
// ---------------------------------------------------------------------------

const TECH_TERMS: readonly string[] = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Express",
  "Python",
  "pip",
  "Django",
  "Flask",
  "FastAPI",
  "npm",
  "pnpm",
  "Yarn",
  "Git",
  "GitHub",
  "GitHub Actions",
  "Docker",
  "Docker Compose",
  "Kubernetes",
  "PostgreSQL",
  "MySQL",
  "MariaDB",
  "MongoDB",
  "Redis",
  "Supabase",
  "Firebase",
  "Firestore",
  "JWT",
  "OAuth",
  "CORS",
  "TLS",
  "SSL",
  "WebSocket",
  "HTTP",
  "Windows",
  "macOS",
  "Linux",
  "GRUB",
  "NTFS",
  "Wi-Fi",
  "Bluetooth",
  "VPN",
  "Nginx",
  "Apache",
  "AWS",
  "EC2",
  "S3",
  "Lambda",
  "VS Code",
  "Chrome",
  "Firefox",
  "Edge",
  "Excel",
  "Word",
  "Outlook",
  "PowerPoint",
  "Microsoft Store",
  "Google Drive",
  "Google Docs",
  "Google Sheets",
  "Gmail",
  "Zoom",
  "Microsoft Teams",
  "Google Meet",
  "Android",
  "iPhone",
  "iPad",
  "iOS",
  "NVIDIA",
  "GPU",
  "NVMe",
  "SSD",
  "HDD",
  "USB",
  "OneDrive",
  "Maven",
  "Gradle",
  "CMake",
  "Cargo",
  "Rust",
  "Go",
  "Java",
  "C++",
  "IMAP",
  "SMTP",
  "SPF",
  "DKIM",
  "DNS",
  "cron",
  "systemd",
  "Spotlight",
  "Finder",
  "AirDrop",
  "iCloud",
  "File Explorer",
  "PowerShell",
  "Postman",
  "XMP",
  "BIOS",
];

const TECH_PATTERNS: ReadonlyArray<{ term: string; pattern: RegExp }> = TECH_TERMS.map((term) => {
  const body = term
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  // Prefix consume (not lookbehind) so every browser can run this safely.
  return { term, pattern: new RegExp(`(?:^|[^a-z0-9])${body}(?![a-z0-9])`, "i") };
});

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "because",
  "before",
  "being",
  "below",
  "between",
  "cannot",
  "could",
  "does",
  "down",
  "during",
  "each",
  "even",
  "every",
  "from",
  "have",
  "into",
  "itself",
  "more",
  "most",
  "never",
  "only",
  "other",
  "over",
  "same",
  "says",
  "should",
  "some",
  "still",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** URL-safe slug derived from a title (camelCase split, punctuation stripped). */
export function slugify(title: string): string {
  return title
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
}

function detectTechnologies(title: string): string[] {
  const found: string[] = [];
  for (const { term, pattern } of TECH_PATTERNS) {
    if (pattern.test(title)) found.push(term);
  }
  return found;
}

function fallbackTags(title: string): string[] {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9+#.]/g, ""))
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
  return words.slice(0, 3);
}

/**
 * Lowercase and strip punctuation for search. Tech compounds are joined
 * (Wi-Fi → wifi, node.js → nodejs) so query tokens match titles directly,
 * while real word boundaries are preserved (no cross-word false hits).
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-._/]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sharedCount(a: readonly string[], b: readonly string[]): number {
  const set = new Set(b);
  let n = 0;
  for (const v of a) if (set.has(v)) n += 1;
  return n;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// ---------------------------------------------------------------------------
// Curated ranking
// ---------------------------------------------------------------------------

/**
 * Hand-curated section priority: broadest, most frequently reported problem
 * families first, alternating platforms so the top of the library stays
 * diverse. Problems are dealt round-robin across these sections so
 * curatedRank interleaves platforms instead of block-ordering them.
 */
const CURATED_SECTION_ORDER: readonly string[] = [
  "everyday-tech",
  "react",
  "windows-update-boot",
  "wifi",
  "python",
  "windows-performance",
  "chrome-edge-firefox",
  "npm-pnpm-packages",
  "docker",
  "laptop-battery-power",
  "bluetooth",
  "nextjs",
  "windows-files-storage",
  "git-github",
  "microsoft-office",
  "nodejs-express",
  "internet-dns-router",
  "windows-ui-apps",
  "postgresql",
  "macos",
  "vscode-ides",
  "printers-scanners",
  "android",
  "javascript-typescript",
  "pc-hardware-performance",
  "api-authentication",
  "linux",
  "email-clients",
  "iphone-ipad",
  "django-flask-fastapi",
  "gpu-display",
  "vpn",
  "ethernet-local-network",
  "google-workspace",
  "security-permissions",
  "mongodb-redis",
  "audio-microphone-camera",
  "mysql-mariadb",
  "zoom-teams-meet",
  "kubernetes",
  "cors-http-ssl",
  "cicd",
  "compiler-build-errors",
  "ssd-hdd-storage",
  "nginx-apache-web-servers",
  "aws-cloud",
  "domain-dns-email",
  "deployment-production",
  "supabase-firebase",
  "performance-reliability",
];

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const primaryBySlug = new Map(PRIMARY_SECTIONS.map((s) => [s.slug, s]));

function buildProblems(): CanonicalProblem[] {
  const problems: CanonicalProblem[] = [];
  const byId = new Map<string, CanonicalProblem>();
  const usedSlugs = new Set<string>();

  for (const raw of PROBLEM_CATALOG) {
    const { id, title } = raw;
    const section = sectionFor(raw);
    const technologies = unique([...(raw.technologies ?? section.technologies), ...detectTechnologies(title)]);
    let tags = unique([...(raw.technologies ?? section.technologies), ...detectTechnologies(title)]).slice(0, 4);
    if (tags.length === 0) tags = fallbackTags(title);

    let slug = slugify(title);
    if (!slug || usedSlugs.has(slug)) slug = `${slug || "problem"}-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    usedSlugs.add(slug);

    const platform = raw.platform ?? section.platform;
    const difficulty: ProblemDifficulty = raw.difficulty ?? section.difficulty;
    const problemType = raw.problemType ?? section.problemType;

    const searchableText = [
      title,
      section.primaryCategory,
      ...platform,
      ...technologies,
      ...tags,
      section.searchKeywords,
    ].join(" ");

    const problem: CanonicalProblem = {
      id,
      slug,
      title,
      primaryCategory: section.primaryCategory,
      primarySection: section.slug,
      secondarySections: [],
      tags,
      platform: [...platform],
      technologies,
      difficulty,
      problemType,
      searchableText,
      sample: true,
      problemStatus: "SAMPLE",
      verificationSource: "NONE",
      curatedRank: 0,
      filter: section.filter,
      row: section.row,
    };

    problems.push(problem);
    byId.set(id, problem);
  }

  // Cross-topic placements: references only, one extra section per problem max.
  for (const cross of CROSS_SECTIONS) {
    for (const id of cross.problemIds) {
      const problem = byId.get(id);
      if (problem) problem.secondarySections.push(cross.slug);
    }
  }

  // Curated ranking: round-robin across the curated section order.
  let rank = 1;
  for (let round = 0; round < 10; round += 1) {
    for (const slug of CURATED_SECTION_ORDER) {
      const section = primaryBySlug.get(slug);
      if (!section) continue;
      const id = section.problemIds[round];
      const problem = byId.get(id);
      if (problem) problem.curatedRank = rank;
      rank += 1;
    }
  }

  return problems;
}

function sectionFor(raw: RawProblem): PrimaryProblemSection {
  const index = Number.parseInt(raw.id.replace("PUV-", ""), 10);
  const sectionIndex = Math.min(50, Math.ceil(index / 10));
  const section = PRIMARY_SECTIONS[sectionIndex - 1];
  if (!section) throw new Error(`No primary section for ${raw.id}`);
  return section;
}

export const canonicalProblems: CanonicalProblem[] = buildProblems();

export const PROBLEM_COUNT = 700;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const problemById = new Map(canonicalProblems.map((p) => [p.id, p]));
const problemBySlug = new Map(canonicalProblems.map((p) => [p.slug, p]));
const sectionBySlug = new Map(ALL_PROBLEM_SECTIONS.map((s) => [s.slug, s]));

export function getProblemById(id: string): CanonicalProblem | undefined {
  return problemById.get(id);
}

export function getProblemBySlug(slug: string): CanonicalProblem | undefined {
  return problemBySlug.get(slug);
}

export function getSectionBySlug(slug: string): ProblemSection | undefined {
  return sectionBySlug.get(slug);
}

export function getProblemsForSection(section: ProblemSection): CanonicalProblem[] {
  return section.problemIds
    .map((id) => problemById.get(id))
    .filter((p): p is CanonicalProblem => Boolean(p));
}

/** All primary sections, optionally narrowed to one broad filter. */
export function getPrimarySections(filter?: ProblemFilter | "All"): PrimaryProblemSection[] {
  if (!filter || filter === "All") return [...PRIMARY_SECTIONS];
  return PRIMARY_SECTIONS.filter((s) => s.filter === filter);
}

export function getCrossSections(): ProblemSection[] {
  return [...CROSS_SECTIONS];
}

/** Top problems by curated rank — used for featured/landing displays. */
export function featuredProblems(limit = 12): CanonicalProblem[] {
  return [...canonicalProblems].sort((a, b) => a.curatedRank - b.curatedRank).slice(0, limit);
}

/** Homepage marquee slice for one display row (curated order, capped). */
export function problemsByRow(row: ProblemRow, limit = 12): CanonicalProblem[] {
  return canonicalProblems
    .filter((p) => p.row === row)
    .sort((a, b) => a.curatedRank - b.curatedRank)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Search + filters
// ---------------------------------------------------------------------------

interface SearchEntry {
  problem: CanonicalProblem;
  title: string;
  tags: string;
  text: string;
}

function buildSearchEntries(): SearchEntry[] {
  return canonicalProblems.map((problem) => ({
    problem,
    title: normalizeForSearch(problem.title),
    tags: normalizeForSearch(problem.tags.join(" ")),
    text: normalizeForSearch(problem.searchableText),
  }));
}

const SEARCH_ENTRIES = buildSearchEntries();

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]+/g, ""))
    .filter(Boolean);
}

/**
 * Partial, token-based search across title, category, technologies,
 * platforms, tags, and section keywords. Every token must match; results are
 * ranked by match strength, then curatedRank (deterministic).
 */
export function searchProblems(query: string, filter: "All" | ProblemFilter = "All"): CanonicalProblem[] {
  const tokens = tokenize(query);
  const results: Array<{ problem: CanonicalProblem; score: number }> = [];

  for (const entry of SEARCH_ENTRIES) {
    if (filter !== "All" && entry.problem.filter !== filter) continue;
    if (tokens.length === 0) {
      results.push({ problem: entry.problem, score: 0 });
      continue;
    }

    let score = 0;
    let matched = true;
    for (const token of tokens) {
      const inTitle = entry.title.includes(token);
      const inTags = entry.tags.includes(token);
      const inText = entry.text.includes(token);
      if (!inTitle && !inTags && !inText) {
        matched = false;
        break;
      }
      score += inTitle ? 3 : inTags ? 2 : 1;
    }
    if (matched) results.push({ problem: entry.problem, score });
  }

  return results
    .sort((a, b) => b.score - a.score || a.problem.curatedRank - b.problem.curatedRank)
    .map((r) => r.problem);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface ProblemPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
}

export function paginate<T>(items: readonly T[], page: number, perPage = PROBLEM_PAGE_SIZE): ProblemPage<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: safePage,
    totalPages,
    total,
    perPage,
  };
}

/** Total pages for the full library at the standard page size. */
export const PROBLEM_TOTAL_PAGES = Math.ceil(PROBLEM_COUNT / PROBLEM_PAGE_SIZE);

export function parseProblemPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export function parseProblemFilter(value: string | string[] | undefined): ProblemFilter | "All" {
  const raw = Array.isArray(value) ? value[0] : value;
  return isProblemFilter(raw) ? raw : "All";
}

export function isProblemFilter(value: unknown): value is ProblemFilter {
  return (
    value === "Coding" ||
    value === "System" ||
    value === "Network" ||
    value === "Device" ||
    value === "Productivity" ||
    value === "Development Tools"
  );
}

// ---------------------------------------------------------------------------
// Related problems
// ---------------------------------------------------------------------------

/**
 * Up to `limit` related problems, scored by shared technology, platform,
 * problem type, tags, filter, and section — never random. Ties break on
 * curatedRank so ordering is deterministic.
 */
export function getRelatedProblems(problem: CanonicalProblem, limit = 5): CanonicalProblem[] {
  const scored: Array<{ problem: CanonicalProblem; score: number }> = [];

  for (const candidate of canonicalProblems) {
    if (candidate.id === problem.id) continue;
    let score = 0;
    score += sharedCount(candidate.technologies, problem.technologies) * 3;
    score += sharedCount(candidate.platform, problem.platform) * 2;
    score += sharedCount(candidate.tags, problem.tags);
    if (candidate.problemType === problem.problemType) score += 2;
    if (candidate.filter === problem.filter) score += 1;
    if (candidate.primarySection === problem.primarySection) score += 1;
    if (score > 0) scored.push({ problem: candidate, score });
  }

  scored.sort((a, b) => b.score - a.score || a.problem.curatedRank - b.problem.curatedRank);
  const related = scored.slice(0, limit).map((s) => s.problem);

  if (related.length < limit) {
    const included = new Set(related.map((p) => p.id));
    const fillers = canonicalProblems
      .filter((p) => p.id !== problem.id && p.filter === problem.filter && !included.has(p.id))
      .sort((a, b) => a.curatedRank - b.curatedRank);
    for (const f of fillers) {
      if (related.length >= limit) break;
      related.push(f);
    }
  }

  return related;
}

// ---------------------------------------------------------------------------
// Live Diagnosis integration
// ---------------------------------------------------------------------------

/** Maps the broad discovery filter to the diagnosis wizard category. */
export function filterToDiagnosisCategory(
  filter: ProblemFilter
): "Coding Error" | "Windows / OS" | "Network & Wi-Fi" | "Hardware & Devices" | "Apps & Productivity" {
  switch (filter) {
    case "Coding":
    case "Development Tools":
      return "Coding Error";
    case "System":
      return "Windows / OS";
    case "Network":
      return "Network & Wi-Fi";
    case "Device":
      return "Hardware & Devices";
    case "Productivity":
      return "Apps & Productivity";
  }
}

/**
 * Link that opens Puvexa Live Diagnosis with this exact problem prefilled.
 * `p` preserves the canonical record, `ctx` prefills structured context, and
 * `q`/`cat` keep older links working.
 */
export function diagnoseHref(problem: CanonicalProblem): string {
  const params = new URLSearchParams();
  params.set("p", problem.id);
  params.set("q", problem.title);
  params.set("cat", filterToDiagnosisCategory(problem.filter));
  params.set("ctx", diagnosisContext(problem));
  return `/diagnose?${params.toString()}`;
}

/** Prefilled diagnosis context generated from structured data (no invented outcomes). */
export function diagnosisContext(problem: CanonicalProblem): string {
  const env = problem.platform.join(", ") || "unspecified environment";
  return `${problem.title} (${problem.primaryCategory}) — ${env}. What changed recently, what have you tried, and what happens now? Add logs, screenshots, or code below.`;
}

// ---------------------------------------------------------------------------
// SEO helpers (programmatic, generated from structured data)
// ---------------------------------------------------------------------------

/** Root layout appends "· Puvexa AI" via the metadata title template. */
export function problemSeoTitle(problem: CanonicalProblem): string {
  return problem.title;
}

export function problemSeoDescription(problem: CanonicalProblem): string {
  return `${problem.title} — diagnose it with Puvexa AI and explore fixes matched to your environment.`;
}

export function sectionSeoDescription(section: ProblemSection): string {
  return `${section.description} Browse ${section.problemIds.length} problems and start a Puvexa diagnosis.`;
}
