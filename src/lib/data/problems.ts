// Puvexa Top 500 canonical problem library + Discovery Library expansion.
//
// Assembles the raw catalog (problem-catalog.ts) with section defaults
// (problem-sections.ts) into canonical problem records, then exposes the
// search / filter / pagination / related-problem APIs used by the UI.
//
// Discovery Library: Expands to 700 display entries for unfiltered browsing
// while maintaining 500 unique canonical records, PUV-0001 … PUV-0500.
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
// Discovery Library: 700 display entries
// ---------------------------------------------------------------------------

/**
 * Seed for deterministic shuffling of reused problems.
 * Using a fixed seed ensures the same ordering across renders and refreshes.
 */
const DISCOVERY_SEED = "puvexa-discovery-2026";

/**
 * Deterministic Fisher-Yates shuffle using a seeded random number generator.
 * This ensures consistent ordering across server and client renders.
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  
  // Simple deterministic hash-based RNG
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return hash;
  };
  
  const seededRandom = (index: number) => {
    const combined = `${seed}-${index}`;
    const h = hashCode(combined);
    return (h % 10000) / 10000; // Normalize to [0, 1)
  };
  
  // Fisher-Yates shuffle
  while (currentIndex > 0) {
    const randomIndex = Math.floor(seededRandom(currentIndex) * currentIndex);
    [shuffled[currentIndex], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[currentIndex],
    ];
    currentIndex--;
  }
  
  return shuffled;
}

/**
 * Display key for duplicated problems in the discovery list.
 * Uses format: `${problem.id}-${displayIndex}` to ensure React list keys are unique
 * while preserving the canonical problem.id for Live Diagnosis integration.
 */
export type DiscoveryProblem = CanonicalProblem & {
  displayIndex: number;
};

/**
 * Create a display key for list rendering.
 * This ensures React can properly track duplicated problems in the list.
 */
export function getDiscoveryKey(problem: DiscoveryProblem): string {
  return `${problem.id}-${problem.displayIndex}`;
}

/**
 * Get the canonical problem ID (without display index) for Live Diagnosis.
 */
export function getCanonicalProblemId(problem: DiscoveryProblem): string {
  return problem.id;
}

/**
 * Build the discovery library with exactly 700 entries.
 * 
 * If canonicalProblems has 700 or more entries:
 *   - Use the first 700 directly
 * 
 * If canonicalProblems has fewer than 700 entries:
 *   1. Include all canonical problems first
 *   2. Create additional display references to reach 700
 *   3. Shuffle and distribute duplicates to avoid adjacent repetition
 *   4. Ensure no duplicates on the same page (10 per page)
 *   5. Maintain category diversity
 */
function buildDiscoveryProblems(): DiscoveryProblem[] {
  const ITEMS_PER_PAGE = 10;
  const TARGET_COUNT = 700;
  const source = canonicalProblems;
  
  // If we already have 700+ canonical problems, use them directly
  if (source.length >= TARGET_COUNT) {
    return source.slice(0, TARGET_COUNT).map((p, i) => ({ ...p, displayIndex: i }));
  }
  
  // We have fewer than 700 canonical problems, need to create additional entries
  const needed = TARGET_COUNT - source.length;
  
  // Create a shuffled pool of canonical problems for reuse
  const shuffledPool = seededShuffle(source, DISCOVERY_SEED);
  
  // Build discovery problems: start with all canonical, then add reused ones
  const discovery: DiscoveryProblem[] = source.map((p, i) => ({ ...p, displayIndex: i }));
  
  // Add additional entries from the shuffled pool
  let poolIndex = 0;
  let safetyCounter = 0;
  const MAX_ATTEMPTS = 1000; // Prevent infinite loops
  
  for (let i = 0; i < needed; i++) {
    safetyCounter++;
    if (safetyCounter > MAX_ATTEMPTS) {
      // Fallback: just add the problem even if it causes duplicates on the page
      // This should never happen with reasonable inputs
      console.warn("Discovery problem generation: max attempts reached, using fallback");
      const reused = shuffledPool[poolIndex % shuffledPool.length];
      discovery.push({ ...reused, displayIndex: discovery.length });
      poolIndex++;
      safetyCounter = 0;
      continue;
    }
    
    const reused = shuffledPool[poolIndex % shuffledPool.length];
    
    // Ensure reused is defined
    if (!reused) {
      poolIndex++;
      i--;
      continue;
    }
    
    // Ensure we don't add the same problem consecutively
    // and avoid duplicates on the same page
    const currentPage = Math.floor(discovery.length / ITEMS_PER_PAGE);
    const currentPageStart = currentPage * ITEMS_PER_PAGE;
    const currentPageEnd = currentPageStart + ITEMS_PER_PAGE;
    
    // Check if this problem is already on the current page
    const pageProblems = discovery.slice(currentPageStart, currentPageEnd);
    const alreadyOnPage = pageProblems.some((p: DiscoveryProblem) => p && p.id === reused.id);
    
    // Check if the previous problem is the same
    const lastAdded = discovery[discovery.length - 1];
    const sameAsLast = lastAdded && lastAdded.id === reused.id;
    
    // If either condition is true, move to next in pool
    if (alreadyOnPage || sameAsLast) {
      poolIndex++;
      // Wrap around if we reach the end
      if (poolIndex >= shuffledPool.length) {
        poolIndex = 0;
      }
      i--; // Retry this position
      continue;
    }
    
    // Add the reused problem
    discovery.push({ ...reused, displayIndex: discovery.length });
    poolIndex++;
    safetyCounter = 0;
  }
  
  return discovery;
}

/**
 * The discovery library with exactly 700 display entries.
 * This is the dataset used for the unfiltered Discovery Library view.
 */
export const discoveryProblems: DiscoveryProblem[] = buildDiscoveryProblems();

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
 * 
 * Note: This searches the canonical problem dataset (500 unique problems).
 * For the unfiltered Discovery Library view, use getDiscoveryProblems() instead.
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
// Discovery Library API
// ---------------------------------------------------------------------------

/**
 * Get problems for the Discovery Library.
 * When no query or filter is specified, returns the full 700-entry discovery list.
 * When query or filter is specified, returns filtered results from canonical problems.
 */
export function getDiscoveryProblems(
  query: string = "",
  filter: "All" | ProblemFilter = "All"
): DiscoveryProblem[] {
  // If no query and no filter (or filter is "All"), return the full discovery list
  if (query.trim() === "" && filter === "All") {
    return discoveryProblems;
  }
  
  // Otherwise, search canonical problems and convert to DiscoveryProblem format
  const canonicalResults = searchProblems(query, filter);
  return canonicalResults.map((p, i) => ({
    ...p,
    displayIndex: i, // Use index in filtered results as displayIndex
  }));
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
