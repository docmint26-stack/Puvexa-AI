import { describe, expect, it } from "vitest";

import {
  PROBLEM_COUNT,
  PROBLEM_FILTERS,
  PROBLEM_ROWS,
  filterToDiagnosisCategory,
  problemsByRow,
  searchProblems,
  topProblems,
  type ProblemFilter,
  type ProblemRow,
  type ProblemTrend,
} from "@/lib/data";

describe("topProblems discovery dataset", () => {
  it("contains between 140 and 180 problems", () => {
    expect(topProblems.length).toBeGreaterThanOrEqual(140);
    expect(topProblems.length).toBeLessThanOrEqual(180);
    expect(PROBLEM_COUNT).toBe(topProblems.length);
  });

  it("has unique, sequential ids", () => {
    const ids = topProblems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    topProblems.forEach((p, i) => {
      expect(p.id).toBe(`problem-${String(i + 1).padStart(3, "0")}`);
    });
  });

  it("defines valid trend, difficulty, row, and filter on every problem", () => {
    const trends: ProblemTrend[] = ["rising", "steady", "new"];
    const rows: ProblemRow[] = PROBLEM_ROWS.map((r) => r.label);
    const filters: ProblemFilter[] = PROBLEM_FILTERS.filter((f) => f.label !== "All").map(
      (f) => f.label as ProblemFilter
    );
    for (const p of topProblems) {
      expect(trends).toContain(p.trend);
      expect(["Easy", "Intermediate", "Advanced"]).toContain(p.difficulty);
      expect(rows).toContain(p.row);
      expect(filters).toContain(p.filter);
      expect(p.searchCount).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(20);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });

  it("splits the dataset across all four rows, grouped stably", () => {
    const perRow = PROBLEM_ROWS.map((r) => problemsByRow(r.label));
    expect(perRow.reduce((sum, list) => sum + list.length, 0)).toBe(PROBLEM_COUNT);
    for (const list of perRow) {
      expect(list.length).toBeGreaterThan(20);
    }
  });

  it("searches by keyword across title, tags, and context", () => {
    const results = searchProblems("Windows", "All");
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      const haystack = [p.title, p.platform ?? "", p.shortContext ?? "", ...p.tags].join(" ").toLowerCase();
      expect(haystack).toContain("windows");
    }
  });

  it("filters by category group", () => {
    const coding = searchProblems("", "Coding");
    expect(coding.length).toBeGreaterThan(0);
    expect(coding.every((p) => p.filter === "Coding")).toBe(true);
  });

  it("maps each broad filter to a diagnosis wizard category", () => {
    expect(filterToDiagnosisCategory("Coding")).toBe("Coding Error");
    expect(filterToDiagnosisCategory("Development Tools")).toBe("Coding Error");
    expect(filterToDiagnosisCategory("System")).toBe("Windows / OS");
    expect(filterToDiagnosisCategory("Network")).toBe("Network & Wi-Fi");
    expect(filterToDiagnosisCategory("Device")).toBe("Hardware & Devices");
    expect(filterToDiagnosisCategory("Productivity")).toBe("Apps & Productivity");
  });
});