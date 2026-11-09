import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FlaskConical } from "lucide-react";

import { ProblemCard } from "@/components/problems/problem-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canonicalProblems,
  diagnosisContext,
  diagnoseHref,
  getProblemBySlug,
  getRelatedProblems,
  getSectionBySlug,
  problemSeoDescription,
  problemSeoTitle,
} from "@/lib/data";

type ProblemPageParams = { slug: string };

export function generateStaticParams(): Array<{ slug: string }> {
  return canonicalProblems.map((problem) => ({ slug: problem.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ProblemPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) return { title: "Problem not found" };
  return {
    title: problemSeoTitle(problem),
    description: problemSeoDescription(problem),
    openGraph: { title: problem.title, description: problemSeoDescription(problem), type: "article" },
  };
}

export default async function ProblemDetailPage({ params }: { params: Promise<ProblemPageParams> }) {
  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) notFound();

  const primarySection = getSectionBySlug(problem.primarySection);
  const crossSections = problem.secondarySections
    .map((s) => getSectionBySlug(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const related = getRelatedProblems(problem, 5);

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
        {primarySection && (
          <>
            <Link href={`/problems/section/${primarySection.slug}`} className="transition-colors hover:text-primary">
              {primarySection.title}
            </Link>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span className="text-foreground">{problem.id}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{problem.primaryCategory}</Badge>
        <Badge variant="outline">{problem.difficulty}</Badge>
        <Badge variant="outline">{problem.problemType}</Badge>
        <span className="text-[11px] text-muted-foreground">{problem.platform.join(" · ")}</span>
      </div>

      <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
        {problem.title}
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        A {problem.difficulty} {problem.problemType} problem in {problem.primaryCategory}, typically seen on{" "}
        {problem.platform.join(" or ")}. Start a Puvexa diagnosis to record what changed, attach logs or screenshots,
        and get ranked step-by-step fixes for your environment.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button render={<Link href={diagnoseHref(problem)} />}>
          Start diagnosis <ArrowUpRight className="size-4" />
        </Button>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FlaskConical className="size-3.5" />
          Title, category, and context are prefilled — just describe what you see.
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Prefilled context</p>
        <p className="mt-1">{diagnosisContext(problem)}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Sections:</span>
        {primarySection && (
          <Link
            href={`/problems/section/${primarySection.slug}`}
            className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary transition-colors hover:bg-primary/20"
          >
            {primarySection.title}
          </Link>
        )}
        {crossSections.map((s) => (
          <Link
            key={s.slug}
            href={`/problems/section/${s.slug}`}
            className="rounded-full border border-dashed border-border px-2.5 py-0.5 font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            {s.title}
          </Link>
        ))}
      </div>

      {problem.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">Tags:</span>
          {problem.tags.map((t) => (
            <span key={t} className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Record {problem.id} · status {problem.problemStatus} · human verification{" "}
        {problem.verificationSource === "NONE" ? "not yet recorded" : problem.verificationSource}
      </p>

      <section aria-labelledby="related-heading" className="mt-10 border-t border-border/60 pt-8">
        <h2 id="related-heading" className="text-lg font-semibold text-foreground">
          Related problems
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => (
            <ProblemCard key={r.id} problem={r} />
          ))}
        </div>
      </section>

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
