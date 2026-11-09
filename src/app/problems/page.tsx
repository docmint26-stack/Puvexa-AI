import Link from "next/link";
import type { Metadata } from "next";

import { AnimatedProblemsContent } from "@/components/problems/animated-problems-content";
import {
  ALL_PROBLEM_SECTIONS,
  PROBLEM_COUNT,
  paginate,
  parseProblemFilter,
  parseProblemPage,
  searchProblems,
  type ProblemFilter,
} from "@/lib/data";

type ProblemsSearchParams = {
  page?: string | string[];
  q?: string | string[];
  filter?: string | string[];
};

function take(value?: string | string[]): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const metadata: Metadata = {
  title: `Top 700 technical problems`,
  description: `Browse 700 curated technical problems across coding, systems, networks, devices, and productivity — tap any card to start a Puvexa diagnosis with the problem prefilled.`,
};

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<ProblemsSearchParams>;
}) {
  const sp = await searchParams;
  const query = take(sp.q)?.trim() ?? "";
  const filter = parseProblemFilter(sp.filter);
  const page = parseProblemPage(sp.page);

  const results = searchProblems(query, filter);
  const paged = paginate(results, page);
  const primarySections = ALL_PROBLEM_SECTIONS.filter((s) => s.kind === "primary");
  const crossSections = ALL_PROBLEM_SECTIONS.filter((s) => s.kind === "cross");

  return (
    <AnimatedProblemsContent
      paged={paged}
      query={query}
      filter={filter}
      primarySections={primarySections}
      crossSections={crossSections}
      problemCount={PROBLEM_COUNT}
    />
  );
}
