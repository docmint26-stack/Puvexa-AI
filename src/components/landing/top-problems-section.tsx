"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Minus, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/shared/icon";
import { Reveal } from "@/components/shared/motion";
import { formatCompact } from "@/lib/format";
import {
  PROBLEM_COUNT,
  PROBLEM_FILTERS,
  PROBLEM_ROWS,
  filterToDiagnosisCategory,
  problemsByRow,
  searchProblems,
  type ProblemFilter,
  type ProblemRow,
  type ProblemTrend,
  type TopProblem,
} from "@/lib/data";

type FilterOrAll = "All" | ProblemFilter;

const ROW_ICONS: Record<ProblemRow, string> = {
  "Coding & Development": "code",
  "Windows & Devices": "monitor",
  "Networking & Connectivity": "wifi",
  "Apps & Productivity": "layout-grid",
};

function diagnoseLink(p: TopProblem): string {
  const params = new URLSearchParams();
  params.set("q", p.title);
  params.set("cat", filterToDiagnosisCategory(p.filter));
  if (p.shortContext) params.set("ctx", p.shortContext);
  params.set("f", p.filter);
  return `/diagnose?${params.toString()}`;
}

function TrendPill({ trend }: { trend: ProblemTrend }) {
  const map = {
    rising: {
      icon: TrendingUp,
      label: "Rising",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    },
    new: {
      icon: Sparkles,
      label: "New",
      className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    },
    steady: {
      icon: Minus,
      label: "Steady",
      className: "border-border bg-muted/50 text-muted-foreground",
    },
  } as const;
  const t = map[trend];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        t.className
      )}
    >
      <t.icon className="size-3" /> {t.label}
    </span>
  );
}

function CompactCard({ p }: { p: TopProblem }) {
  return (
    <Link
      href={diagnoseLink(p)}
      className="group flex shrink-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card/60 py-2 pl-2 pr-3 ring-1 ring-foreground/5 transition-colors hover:border-primary/40 hover:bg-card"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        <Icon name={ROW_ICONS[p.row]} className="size-3.5" />
      </span>
      <span className="block w-60 min-w-0 sm:w-64">
        <span className="block truncate text-xs font-medium text-foreground">{p.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <TrendPill trend={p.trend} />
          <span aria-hidden="true">·</span>
          <span className="truncate">{formatCompact(p.searchCount)} searches</span>
        </span>
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}

function ResultCard({ p }: { p: TopProblem }) {
  return (
    <Link
      href={diagnoseLink(p)}
      className="group flex h-full flex-col rounded-xl border border-border/70 bg-card/50 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {p.category}
        </Badge>
        <TrendPill trend={p.trend} />
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{p.title}</p>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.shortContext}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {p.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[10px]">
        <span className="text-muted-foreground">
          {formatCompact(p.searchCount)} searches · {p.difficulty}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          Ask Puvexa <ArrowUpRight className="size-3" />
        </span>
      </div>
    </Link>
  );
}

function MarqueeRow({ row, items, reverse }: { row: TopProblem["row"]; items: TopProblem[]; reverse?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="group">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon name={ROW_ICONS[row]} className="size-4 text-primary" />
        <p className="text-xs font-semibold text-foreground">{row}</p>
        <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{PROBLEM_ROWS.find((r) => r.label === row)?.blurb}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 py-2 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
        <div
          className={cn(
            "flex w-max items-center gap-2.5 px-2.5 animate-marquee",
            "motion-reduce:animate-none",
            "group-hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
          )}
          style={reverse ? { animationDirection: "reverse" } : undefined}
        >
          {items.map((p) => (
            <CompactCard key={p.id} p={p} />
          ))}
          <div aria-hidden="true" className="flex items-center gap-2.5 motion-reduce:hidden">
            {items.map((p) => (
              <CompactCard key={`dup-${p.id}`} p={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TopProblemsSection() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterOrAll>("All");

  const active = query.trim().length > 0 || filter !== "All";
  const results = React.useMemo(() => searchProblems(query, filter), [query, filter]);
  const activeFilter = PROBLEM_FILTERS.find((f) => f.label === filter);
  const clear = () => {
    setQuery("");
    setFilter("All");
  };

  return (
    <section id="top-problems" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Trending technical problems</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            The problems people ask Puvexa to fix
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Explore {PROBLEM_COUNT} realistic sample examples across coding, Windows, networking, and productivity —
            tap one to start a diagnosis and get ranked, step-by-step fixes.
          </p>
        </div>
      </Reveal>

      <div className="relative mx-auto mt-8 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${PROBLEM_COUNT} sample problems…`}
          aria-label="Search problems"
          className="h-10 rounded-xl pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Filter problems by category" className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {PROBLEM_FILTERS.map((f) => {
          const isActive = filter === f.label;
          return (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(f.label)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {results.length} of {PROBLEM_COUNT} results
              {filter !== "All" && activeFilter ? ` · ${activeFilter.hint}` : ""}
            </p>
            <button type="button" onClick={clear} className="text-xs font-medium text-primary transition-colors hover:underline">
              Clear filters
            </button>
          </div>
          {results.length > 0 ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((p) => (
                <ResultCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border/70 bg-card/30 p-10 text-center">
              <p className="text-sm font-medium text-foreground">No matches found</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Try a different keyword, or clear the filters to browse the full {PROBLEM_COUNT} sample problems.
              </p>
              <button type="button" onClick={clear} className="mt-4 text-xs font-medium text-primary hover:underline">
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-10 space-y-6" aria-label="Sample technical problem rows">
          {PROBLEM_ROWS.map((row, i) => (
            <Reveal key={row.label} delay={i * 0.05}>
              <MarqueeRow row={row.label} items={problemsByRow(row.label)} reverse={i % 2 === 1} />
            </Reveal>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-[10px] text-muted-foreground">
        Sample discovery examples for browsing — not Puvexa production search analytics.
      </p>
    </section>
  );
}