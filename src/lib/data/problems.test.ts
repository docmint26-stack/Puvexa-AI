import { describe, expect, it } from "vitest";

import {
  ALL_PROBLEM_SECTIONS,
  CROSS_SECTIONS,
  PRIMARY_SECTIONS,
  PROBLEM_COUNT,
  PROBLEM_FILTERS,
  PROBLEM_PAGE_SIZE,
  PROBLEM_ROWS,
  PROBLEM_TOTAL_PAGES,
  canonicalProblems,
  diagnoseHref,
  diagnosisContext,
  featuredProblems,
  filterToDiagnosisCategory,
  getProblemById,
  getProblemBySlug,
  getPrimarySections,
  getProblemsForSection,
  getRelatedProblems,
  getSectionBySlug,
  paginate,
  parseProblemFilter,
  parseProblemPage,
  problemsByRow,
  searchProblems,
  type CanonicalProblem,
  type ProblemFilter,
} from "@/lib/data";
import { PROBLEM_CATALOG } from "@/lib/data/problem-catalog";

const WIZARD_CATEGORIES = [
  "Coding Error",
  "Windows / OS",
  "Network & Wi-Fi",
  "Hardware & Devices",
  "Apps & Productivity",
  "Performance",
  "Security",
] as const;

describe("catalog integrity", () => {
  it("ships exactly 700 canonical records, PUV-0001 … PUV-0700", () => {
    expect(PROBLEM_CATALOG).toHaveLength(700);
    expect(canonicalProblems).toHaveLength(700);
    expect(PROBLEM_COUNT).toBe(700);

    const ids = PROBLEM_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(700);
    ids.forEach((id, i) => {
      expect(id).toBe(`PUV-${String(i + 1).padStart(4, "0")}`);
    });
  });

  it("generates unique URL-safe slugs for every record", () => {
    const slugs = canonicalProblems.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(700);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("round-trips every record through id and slug lookups", () => {
    for (const problem of canonicalProblems) {
      expect(getProblemById(problem.id)).toBe(problem);
      expect(getProblemBySlug(problem.slug)).toBe(problem);
    }
  });

  it("assigns a full curatedRank permutation (1 … 700)", () => {
    const ranks = canonicalProblems.map((p) => p.curatedRank).sort((a, b) => a - b);
    expect(ranks[0]).toBe(1);
    expect(ranks[699]).toBe(700);
    expect(new Set(ranks).size).toBe(700);
  });

  it("keeps every record an honest SAMPLE discovery seed", () => {
    for (const problem of canonicalProblems) {
      expect(problem.sample).toBe(true);
      expect(problem.problemStatus).toBe("SAMPLE");
      expect(problem.verificationSource).toBe("NONE");
      // No fabricated metrics may exist on the record shape.
      const record = problem as unknown as Record<string, unknown>;
      expect(record.searchCount).toBeUndefined();
      expect(record.trend).toBeUndefined();
      expect(record.successRate).toBeUndefined();
      expect(record.verificationCount).toBeUndefined();
    }
  });

  it("derives searchable text containing the title", () => {
    for (const problem of canonicalProblems) {
      expect(problem.searchableText).toContain(problem.title);
    }
  });
});

describe("section integrity", () => {
  it("defines 50 primary + 20 cross sections with unique slugs", () => {
    expect(PRIMARY_SECTIONS).toHaveLength(50);
    expect(CROSS_SECTIONS).toHaveLength(20);
    expect(ALL_PROBLEM_SECTIONS).toHaveLength(70);

    const slugs = ALL_PROBLEM_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(70);

    PRIMARY_SECTIONS.forEach((s, i) => expect(s.index).toBe(i + 1));
    CROSS_SECTIONS.forEach((s, i) => expect(s.index).toBe(i + 51));
  });

  it("gives every section exactly 10 known problem ids", () => {
    for (const section of ALL_PROBLEM_SECTIONS) {
      expect(section.problemIds).toHaveLength(10);
      for (const id of section.problemIds) {
        expect(getProblemById(id)).toBeDefined();
      }
      expect(getProblemsForSection(section)).toHaveLength(10);
    }
  });

  it("covers all 700 records exactly once across primary sections", () => {
    const primaryIds = PRIMARY_SECTIONS.flatMap((s) => s.problemIds);
    expect(primaryIds).toHaveLength(700);
    expect(new Set(primaryIds).size).toBe(700);
    const canonicalIds = new Set(canonicalProblems.map((p) => p.id));
    expect(new Set(primaryIds)).toEqual(canonicalIds);
  });

  it("references 280 distinct problems from cross sections (max one cross placement each)", () => {
    const crossIds = CROSS_SECTIONS.flatMap((s) => s.problemIds);
    expect(crossIds).toHaveLength(280);
    expect(new Set(crossIds).size).toBe(280);
    for (const id of crossIds) {
      expect(getProblemById(id)).toBeDefined();
    }
  });

  it("keeps every problem within at most two total sections", () => {
    const crossCount = new Map<string, number>();
    for (const section of CROSS_SECTIONS) {
      for (const id of section.problemIds) {
        crossCount.set(id, (crossCount.get(id) ?? 0) + 1);
      }
    }
    for (const problem of canonicalProblems) {
      expect(problem.secondarySections.length).toBeLessThanOrEqual(1);
      expect(crossCount.get(problem.id) ?? 0).toBeLessThanOrEqual(1);
      expect(problem.secondarySections).toHaveLength(crossCount.get(problem.id) ?? 0);
    }
  });

  it("filters primary sections without losing records", () => {
    const filters: ProblemFilter[] = ["Coding", "System", "Network", "Device", "Productivity", "Development Tools"];
    let covered = 0;
    for (const filter of filters) {
      const sections = getPrimarySections(filter);
      expect(sections.length).toBeGreaterThan(0);
      for (const s of sections) expect(s.filter).toBe(filter);
      covered += sections.length;
    }
    expect(covered).toBe(50);
    expect(getPrimarySections("All")).toHaveLength(50);
    expect(getSectionBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("search acceptance", () => {
  it('ranks "wifi network" with the Wi-Fi connectivity problem first', () => {
    const results = searchProblems("wifi network");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("PUV-0264"); // Laptop cannot see home Wi-Fi network
    expect(results.slice(0, 5).filter((p) => p.primarySection === "wifi").length).toBeGreaterThanOrEqual(3);
  });

  it('ranks "python module not found" with the ModuleNotFoundError problem first', () => {
    const results = searchProblems("python module not found");
    expect(results[0].id).toBe("PUV-0041");
    expect(results[0].title).toContain("ModuleNotFoundError");
  });

  it('returns VS Code problems in the top five for "vs code"', () => {
    const results = searchProblems("vs code");
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.slice(0, 5).every((p) => p.primarySection === "vscode-ides")).toBe(true);
  });

  it('surfaces a React state-update problem in the top ten for "react state update"', () => {
    const results = searchProblems("react state update");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].primarySection).toBe("react");
    expect(results.slice(0, 10).map((p) => p.id)).toContain("PUV-0006"); // updates state but UI does not refresh
  });

  it('covers containers, images, networking, and storage in the top 30 for "docker container"', () => {
    const top = searchProblems("docker container").slice(0, 30);
    const ids = top.map((p) => p.id);
    expect(ids).toContain("PUV-0082"); // container exits immediately
    expect(ids).toContain("PUV-0085"); // image keeps using old code
    expect(ids).toContain("PUV-0086"); // Compose service networking
    expect(ids).toContain("PUV-0087"); // volume / storage
  });

  it('finds at least five Bluetooth problems for "bluetooth"', () => {
    const results = searchProblems("bluetooth");
    expect(results.filter((p) => p.title.includes("Bluetooth")).length).toBeGreaterThanOrEqual(5);
  });

  it("returns the full curated library for an empty query", () => {
    const all = searchProblems("");
    expect(all).toHaveLength(700);
    expect(all[0].curatedRank).toBe(featuredProblems(1)[0].curatedRank);
  });

  it("honors the broad filter inside results", () => {
    const coding = searchProblems("", "Coding");
    expect(coding.length).toBeGreaterThan(0);
    expect(coding.every((p) => p.filter === "Coding")).toBe(true);
    const combined = searchProblems("docker", "Development Tools");
    expect(combined.length).toBeGreaterThan(0);
    expect(combined.every((p) => p.filter === "Development Tools")).toBe(true);
  });

  it("requires every query token to match (no loose OR matching)", () => {
    const nonsense = searchProblems("quantum blockchain zebra");
    expect(nonsense).toHaveLength(0);
  });
});

describe("pagination", () => {
  it("splits the full library into 70 pages of 10", () => {
    const first = paginate(canonicalProblems, 1);
    expect(first.items).toHaveLength(PROBLEM_PAGE_SIZE);
    expect(first.page).toBe(1);
    expect(first.totalPages).toBe(70);
    expect(first.total).toBe(700);
    expect(PROBLEM_TOTAL_PAGES).toBe(70);

    const last = paginate(canonicalProblems, 70);
    expect(last.items).toHaveLength(10);
    expect(last.page).toBe(70);
  });

  it("clamps out-of-range pages instead of erroring", () => {
    expect(paginate(canonicalProblems, 0).page).toBe(1);
    expect(paginate(canonicalProblems, 999).page).toBe(50);
    const empty = paginate([], 3);
    expect(empty.totalPages).toBe(1);
    expect(empty.page).toBe(1);
    expect(empty.items).toHaveLength(0);
  });

  it("parses URL params defensively", () => {
    expect(parseProblemPage(undefined)).toBe(1);
    expect(parseProblemPage("abc")).toBe(1);
    expect(parseProblemPage("3")).toBe(3);
    expect(parseProblemPage(["7", "8"])).toBe(7);
    expect(parseProblemFilter(undefined)).toBe("All");
    expect(parseProblemFilter("Coding")).toBe("Coding");
    expect(parseProblemFilter("Nope")).toBe("All");
  });

  it("keeps search results paginated in stable order", () => {
    const results = searchProblems("wifi");
    const p1 = paginate(results, 1);
    const p2 = paginate(results, 2);
    expect(p1.items).toHaveLength(Math.min(10, results.length));
    if (p2.totalPages > 1) {
      expect(p1.items[0]?.id).not.toBe(p2.items[0]?.id);
    }
    expect(p1.total).toBe(results.length);
  });
});

describe("Live Diagnosis integration", () => {
  it("builds a prefilled diagnosis link for every problem", () => {
    for (const problem of canonicalProblems) {
      const href = diagnoseHref(problem);
      const url = new URL(href, "https://puvexa.example");
      expect(url.pathname).toBe("/diagnose");
      expect(url.searchParams.get("p")).toBe(problem.id);
      expect(url.searchParams.get("q")).toBe(problem.title);
      expect(url.searchParams.get("cat")).toBe(filterToDiagnosisCategory(problem.filter));
      const ctx = url.searchParams.get("ctx");
      expect(ctx).toBeTruthy();
      expect(ctx!.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("maps every filter onto a valid wizard category", () => {
    const filters = PROBLEM_FILTERS.map((f) => f.label).filter((l): l is ProblemFilter => l !== "All");
    expect(filters).toHaveLength(6);
    for (const filter of filters) {
      const category = filterToDiagnosisCategory(filter);
      expect(WIZARD_CATEGORIES).toContain(category);
    }
  });

  it("generates structured context containing the title and category", () => {
    for (const problem of canonicalProblems) {
      const ctx = diagnosisContext(problem);
      expect(ctx).toContain(problem.title);
      expect(ctx).toContain(problem.primaryCategory);
      expect(ctx.length).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("related problems", () => {
  const assertValidRelated = (problem: CanonicalProblem, related: CanonicalProblem[]) => {
    expect(related.length).toBe(5);
    expect(new Set(related.map((r) => r.id)).size).toBe(5);
    for (const r of related) {
      expect(r.id).not.toBe(problem.id);
      const overlap =
        r.technologies.some((t) => problem.technologies.includes(t)) ||
        r.platform.some((t) => problem.platform.includes(t)) ||
        r.filter === problem.filter ||
        r.problemType === problem.problemType ||
        r.primarySection === problem.primarySection;
      expect(overlap).toBe(true);
    }
  };

  it("returns five deterministic, non-self related problems per record", () => {
    for (const problem of canonicalProblems) {
      const related = getRelatedProblems(problem);
      assertValidRelated(problem, related);
      const again = getRelatedProblems(problem);
      expect(again.map((r) => r.id)).toEqual(related.map((r) => r.id));
    }
  });
});

describe("discovery UI data", () => {
  it("exposes the seven broad filters and four display rows", () => {
    expect(PROBLEM_FILTERS.map((f) => f.label)).toEqual([
      "All",
      "Coding",
      "System",
      "Network",
      "Device",
      "Productivity",
      "Development Tools",
    ]);
    expect(PROBLEM_ROWS).toHaveLength(4);
  });

  it("fills every display row with curated problems in rank order", () => {
    let total = 0;
    for (const row of PROBLEM_ROWS) {
      const items = problemsByRow(row.label, 12);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(12);
      const ranks = items.map((p) => p.curatedRank);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
      total += items.length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it("features the top of the curated ranking", () => {
    const featured = featuredProblems(12);
    expect(featured).toHaveLength(12);
    const ranks = featured.map((p) => p.curatedRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(ranks[0]).toBe(1);
  });

  it("builds all homepage marquee rows from the canonical set", () => {
    const all = PROBLEM_ROWS.flatMap((row) => problemsByRow(row.label, 700));
    expect(all.length).toBe(700);
    expect(new Set(all.map((p) => p.id)).size).toBe(700);
  });
});
