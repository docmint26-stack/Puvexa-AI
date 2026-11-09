import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProblemCard } from "@/components/problems/problem-card";
import { Badge } from "@/components/ui/badge";
import {
  ALL_PROBLEM_SECTIONS,
  getProblemsForSection,
  getSectionBySlug,
  sectionSeoDescription,
} from "@/lib/data";

type SectionPageParams = { slug: string };

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_PROBLEM_SECTIONS.map((section) => ({ slug: section.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<SectionPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const section = getSectionBySlug(slug);
  if (!section) return { title: "Section not found" };
  return {
    title: `${section.title} problems`,
    description: sectionSeoDescription(section),
    openGraph: { title: `${section.title} problems`, description: section.description },
  };
}

export default async function SectionPage({ params }: { params: Promise<SectionPageParams> }) {
  const { slug } = await params;
  const section = getSectionBySlug(slug);
  if (!section) notFound();

  const problems = getProblemsForSection(section);
  const isCross = section.kind === "cross";
  const owningSections = isCross
    ? [...new Set(problems.map((p) => p.primarySection))].map((s) => getSectionBySlug(s)).filter((s): s is NonNullable<typeof s> => Boolean(s))
    : [];

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-primary">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/problems" className="transition-colors hover:text-primary">
          Problems
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{section.title}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{isCross ? "Cross-topic view" : "Primary section"}</Badge>
        <Badge variant="outline">{problems.length} problems</Badge>
        {!isCross && <Badge variant="outline">{section.filter}</Badge>}
      </div>

      <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
        {section.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{section.description}</p>

      {isCross && (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-card/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Cross-topic section</p>
          <p className="mt-1">
            This view references problems owned by primary sections — no duplicate records. Owned by:{" "}
            {owningSections.map((s, i) => (
              <span key={s.slug}>
                {i > 0 && ", "}
                <Link href={`/problems/section/${s.slug}`} className="font-medium text-primary hover:underline">
                  {s.title}
                </Link>
              </span>
            ))}
            .
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {problems.map((problem) => (
          <ProblemCard key={problem.id} problem={problem} />
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/problems"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Back to all problems
        </Link>
      </div>
    </div>
  );
}
