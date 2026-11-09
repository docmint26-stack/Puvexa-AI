import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { diagnoseHref, type CanonicalProblem } from "@/lib/data";

/**
 * Discovery card. The card body opens Puvexa Live Diagnosis with this exact
 * problem prefilled; the small "Details" link opens the SEO detail page.
 */
export function ProblemCard({ problem, className }: { problem: CanonicalProblem; className?: string }) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-xl border border-border/70 bg-card/50 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        className
      )}
    >
      <Link
        href={diagnoseHref(problem)}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Start a diagnosis for: ${problem.title}`}
      />
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {problem.primaryCategory}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{problem.difficulty}</span>
      </div>
      <p className="mt-2.5 line-clamp-3 text-sm font-semibold leading-snug text-foreground">{problem.title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {problem.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
      <div className="pointer-events-none relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[10px]">
        <Link
          href={`/problems/${problem.slug}`}
          className="pointer-events-auto font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Details
        </Link>
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          Ask Puvexa <ArrowUpRight className="size-3" />
        </span>
      </div>
    </div>
  );
}
