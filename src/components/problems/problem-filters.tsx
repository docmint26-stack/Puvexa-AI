"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { PROBLEM_COUNT, PROBLEM_FILTERS, type ProblemFilter } from "@/lib/data";

type FilterOrAll = "All" | ProblemFilter;

/**
 * URL-driven search + filter chips for /problems. Typing debounces into
 * `?q=`, chips push `?filter=` and always reset to page 1.
 */
export function ProblemFilters({
  query,
  filter,
  resultCount,
}: {
  query: string;
  filter: FilterOrAll;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = React.useState(query);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const hrefFor = React.useCallback(
    (nextQuery: string, nextFilter: FilterOrAll, page = 1) => {
      const params = new URLSearchParams();
      const q = nextQuery.trim();
      if (q) params.set("q", q);
      if (nextFilter !== "All") params.set("filter", nextFilter);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname]
  );

  const active = query.trim().length > 0 || filter !== "All";
  const activeFilter = PROBLEM_FILTERS.find((f) => f.label === filter);

  // Debounced URL sync for typing.
  React.useEffect(() => {
    const next = value.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      router.replace(hrefFor(next, filter), { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [value, query, filter, hrefFor, router]);

  // Follow URL changes (browser back/forward) while the input is not focused.
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) setValue(query);
  }, [query]);

  const clear = () => {
    setValue("");
    router.push(hrefFor("", "All"), { scroll: false });
  };

  return (
    <div>
      <div className="relative mx-auto max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Search ${PROBLEM_COUNT} problems…`}
          aria-label="Search problems"
          className="h-10 rounded-xl pl-9 pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search input"
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
              onClick={() => router.push(hrefFor(value, f.label), { scroll: false })}
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

      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <p>
          {resultCount} of {PROBLEM_COUNT} problems
          {filter !== "All" && activeFilter ? ` · ${activeFilter.hint}` : ""}
        </p>
        {active && (
          <button type="button" onClick={clear} className="font-medium text-primary transition-colors hover:underline">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
