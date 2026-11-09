"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { ProblemCard } from "./problem-card";
import { ProblemFilters } from "./problem-filters";
import type { ProblemFilter, ProblemSection, DiscoveryProblem } from "@/lib/data";

type FilterWithAll = "All" | ProblemFilter;

interface PaginatedResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

interface AnimatedProblemsContentProps {
  paged: PaginatedResult<DiscoveryProblem>;
  query: string;
  filter: FilterWithAll;
  primarySections: ProblemSection[];
  crossSections: ProblemSection[];
  problemCount: number;
}

function pageHref(page: number, query: string, filter: FilterWithAll): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filter !== "All") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/problems?${qs}` : "/problems";
}

function Pagination({
  page,
  totalPages,
  query,
  filter,
}: {
  page: number;
  totalPages: number;
  query: string;
  filter: FilterWithAll;
}) {
  if (totalPages <= 1) return null;

  const entries: Array<number | "gap-start" | "gap-end"> = [];
  const from = Math.max(2, page - 2);
  const to = Math.min(totalPages - 1, page + 2);
  entries.push(1);
  if (from > 2) entries.push("gap-start");
  for (let p = from; p <= to; p += 1) entries.push(p);
  if (to < totalPages - 1) entries.push("gap-end");
  entries.push(totalPages);

  return (
    <nav aria-label="Problems pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={pageHref(page - 1, query, filter)}
          rel="prev"
          className="rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          Previous
        </Link>
      ) : (
        <span className="cursor-not-allowed rounded-lg border border-border/60 bg-card/20 px-3 py-1.5 text-xs font-medium text-muted-foreground/50">
          Previous
        </span>
      )}

      {entries.map((entry, i) =>
        typeof entry === "number" ? (
          <Link
            key={entry}
            href={pageHref(entry, query, filter)}
            aria-current={entry === page ? "page" : undefined}
            className={
              entry === page
                ? "rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                : "rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            }
          >
            {entry}
          </Link>
        ) : (
          <span key={`${entry}-${i}`} className="px-1 text-xs text-muted-foreground/60">
            …
          </span>
        )
      )}

      {page < totalPages ? (
        <Link
          href={pageHref(page + 1, query, filter)}
          rel="next"
          className="rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          Next
        </Link>
      ) : (
        <span className="cursor-not-allowed rounded-lg border border-border/60 bg-card/20 px-3 py-1.5 text-xs font-medium text-muted-foreground/50">
          Next
        </span>
      )}
    </nav>
  );
}

export function AnimatedProblemsContent({
  paged,
  query,
  filter,
  primarySections,
  crossSections,
  problemCount,
}: AnimatedProblemsContentProps) {
  return (
    <div>
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.p
          className="text-[11px] font-semibold uppercase tracking-wider text-primary"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          Discovery library
        </motion.p>
        <motion.h1
          className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
        >
          Top {problemCount} technical problems
        </motion.h1>
        <motion.p
          className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
        >
          Curated problem cards from {Math.ceil(problemCount / 10)} categories. Search or filter below, then tap any card —
          Puvexa Live Diagnosis opens with that exact problem prefilled.
        </motion.p>
      </motion.div>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <ProblemFilters query={query} filter={filter} resultCount={paged.total} />
      </motion.div>

      {paged.items.length > 0 ? (
        <>
          <motion.div
            className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.05, delayChildren: 0.5 }}
          >
            {paged.items.map((problem) => (
              <motion.div
                key={problem.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <ProblemCard problem={problem} />
              </motion.div>
            ))}
          </motion.div>
          <motion.p
            className="mt-4 text-center text-[11px] text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            Page {paged.page} of {paged.totalPages} · 10 per page
          </motion.p>
          <Pagination page={paged.page} totalPages={paged.totalPages} query={query} filter={filter} />
        </>
      ) : (
        <motion.div
          className="mt-8 rounded-xl border border-dashed border-border/70 bg-card/30 p-10 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.p
            className="text-sm font-medium text-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            No matches found
          </motion.p>
          <motion.p
            className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            Try a different keyword, or clear the filters to browse all {problemCount} problems.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Link
              href="/problems"
              className="mt-4 inline-block text-xs font-medium text-primary transition-colors hover:underline"
            >
              Clear filters
            </Link>
          </motion.div>
        </motion.div>
      )}

      <motion.section
        aria-labelledby="browse-sections"
        className="mt-14 border-t border-border/60 pt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.7 }}
      >
        <motion.h2
          id="browse-sections"
          className="text-center text-lg font-semibold text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          Browse by section
        </motion.h2>
        <motion.div
          className="mt-4 flex flex-wrap justify-center gap-2"
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.02, delayChildren: 1.2 }}
        >
          {primarySections.map((s) => (
            <motion.div
              key={s.slug}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: { opacity: 1, scale: 1 }
              }}
              transition={{ duration: 0.3 }}
            >
              <Link
                href={`/problems/section/${s.slug}`}
                className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {s.title}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.h3
          className="mt-8 text-center text-sm font-semibold text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        >
          Cross-topic views
        </motion.h3>
        <motion.div
          className="mt-3 flex flex-wrap justify-center gap-2"
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.02, delayChildren: 1.4 }}
        >
          {crossSections.map((s) => (
            <motion.div
              key={s.slug}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: { opacity: 1, scale: 1 }
              }}
              transition={{ duration: 0.3 }}
            >
              <Link
                href={`/problems/section/${s.slug}`}
                className="rounded-full border border-dashed border-border bg-card/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {s.title}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>
    </div>
  );
}
