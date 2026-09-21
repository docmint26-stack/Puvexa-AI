"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, CircleCheck, Clock3, Microscope, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { TokenBadge } from "@/components/shared/token-badge";

export interface Recommendation {
  id: string;
  rank: number;
  title: string;
  successRate: number;
  cases: number;
  minutes: string;
  badges: ("Verified" | "High confidence" | "Common fix" | "Low risk" | "Top pick")[];
  tone: "primary" | "muted";
}

export const RECOMMENDATIONS: Recommendation[] = [
  { id: "r1", rank: 1, title: "Disable Wi-Fi power-saving on battery", successRate: 92, cases: 1280, minutes: "4 min", badges: ["Verified", "Top pick", "Low risk"], tone: "primary" },
  { id: "r2", rank: 2, title: "Update the WLAN driver", successRate: 88, cases: 1093, minutes: "8 min", badges: ["High confidence"], tone: "muted" },
  { id: "r3", rank: 3, title: "Reset TCP/IP & renew DHCP lease", successRate: 84, cases: 854, minutes: "6 min", badges: ["Common fix"], tone: "muted" },
  { id: "r4", rank: 4, title: "Disable Fast Startup", successRate: 81, cases: 730, minutes: "3 min", badges: ["Low risk"], tone: "muted" },
  { id: "r5", rank: 5, title: "Forget and reconnect to the Wi-Fi network", successRate: 79, cases: 1410, minutes: "5 min", badges: ["Common fix"], tone: "muted" },
  { id: "r6", rank: 6, title: "Run Windows Network Troubleshooter", successRate: 76, cases: 602, minutes: "7 min", badges: ["Low risk"], tone: "muted" },
  { id: "r7", rank: 7, title: "Flush DNS and reset Winsock", successRate: 75, cases: 955, minutes: "4 min", badges: ["Common fix"], tone: "muted" },
  { id: "r8", rank: 8, title: "Check router band steering settings", successRate: 72, cases: 448, minutes: "10 min", badges: ["High confidence"], tone: "muted" },
  { id: "r9", rank: 9, title: "Reinstall the network adapter", successRate: 71, cases: 389, minutes: "12 min", badges: [], tone: "muted" },
  { id: "r10", rank: 10, title: "Roll back the WLAN driver", successRate: 69, cases: 517, minutes: "9 min", badges: ["Common fix"], tone: "muted" },
  { id: "r11", rank: 11, title: "Disable Bluetooth coexistence", successRate: 67, cases: 231, minutes: "6 min", badges: ["Low risk"], tone: "muted" },
  { id: "r12", rank: 12, title: "Set preferred band to 5 GHz", successRate: 65, cases: 346, minutes: "5 min", badges: [], tone: "muted" },
  { id: "r13", rank: 13, title: "Update chipset / power-management drivers", successRate: 63, cases: 288, minutes: "11 min", badges: ["High confidence"], tone: "muted" },
];

const COLLAPSED_HEIGHT = 292;

const BADGE_STYLE: Record<string, string> = {
  Verified: "border-success/30 bg-success/10 text-success",
  "Top pick": "border-primary/30 bg-primary/10 text-primary",
  "High confidence": "border-violet-400/30 bg-violet-500/10 text-violet-300",
  "Common fix": "border-info/30 bg-info/10 text-info",
  "Low risk": "border-border bg-muted/40 text-muted-foreground",
};

function RecommendationCard({
  rec,
  active,
  onSelect,
}: {
  rec: Recommendation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
        rec.tone === "primary"
          ? "border-primary/40 bg-primary/5 hover:border-primary/60 hover:bg-primary/10"
          : "border-border/60 bg-muted/15 hover:border-primary/30 hover:bg-muted/30",
        active && "border-primary/60 ring-2 ring-primary/20"
      )}
    >
      {active && (
        <span className="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-linear-to-b from-violet-400 to-cyan-400" />
      )}
      {rec.tone === "primary" && (
        <span className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-80" />
      )}
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg font-heading text-xs font-bold tabular-nums transition-colors",
            rec.tone === "primary"
              ? "bg-linear-to-br from-violet-500/25 to-cyan-500/15 text-primary"
              : "bg-muted text-muted-foreground group-hover:text-foreground"
          )}
        >
          #{rec.rank}
        </span>
        <div className="min-w-0 flex-1">
          {rec.badges.includes("Top pick") && (
            <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-linear-to-r from-violet-500/90 to-cyan-500/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              <Sparkles className="size-2.5" /> Top pick
            </span>
          )}
          <p className="truncate text-sm font-semibold text-foreground">{rec.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-success">{rec.successRate}% success</span>
            <span className="mx-1.5 opacity-50">·</span>
            {rec.cases.toLocaleString()} cases
            <span className="mx-1.5 opacity-50">·</span>
            <Clock3 className="mr-0.5 inline size-2.5" />
            {rec.minutes}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {rec.badges.filter((b) => b !== "Top pick").slice(0, rec.tone === "primary" ? 1 : 2).map((b) => (
            <Badge key={b} className={cn("h-4 px-1.5 text-[9px] font-medium", BADGE_STYLE[b])}>
              {b === "Verified" ? <CircleCheck className="size-2.5" /> : b === "High confidence" ? <ShieldCheck className="size-2.5" /> : null}
              {b}
            </Badge>
          ))}
          {rec.tone === "primary" && (
            <span className="mt-0.5 text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Try this fix <ArrowUpRight className="inline size-2.5" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function LiveDiagnosisPanel({
  className,
  context = "Windows 11 · onboard WLAN · battery",
  matchedSignatures = 3,
  reward = 70,
  maxVisible = 4,
}: {
  className?: string;
  context?: string;
  matchedSignatures?: number;
  reward?: number;
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [active, setActive] = React.useState(RECOMMENDATIONS[0].id);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [nearBottom, setNearBottom] = React.useState(false);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setNearBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 56);
  };

  const visible = expanded ? RECOMMENDATIONS : RECOMMENDATIONS.slice(0, maxVisible);
  const hiddenCount = RECOMMENDATIONS.length - visible.length;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-xl", className)}>
      <div className="pointer-events-none absolute -top-16 right-0 size-48 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
            <Microscope className="size-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Live diagnosis</p>
            <p className="text-[10px] text-muted-foreground">{context}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            {matchedSignatures} signatures matched
          </span>
          <TokenBadge value={reward} signed />
        </div>
      </div>

      <p className="relative mt-3 text-[11px] text-muted-foreground">
        Top recommendations based on similar verified cases · ranked by success rate for your exact environment
      </p>

      <div className="relative mt-2">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn(
            "scrollbar-thin space-y-1.5 pr-1",
            expanded ? "max-h-72 overflow-y-auto" : "overflow-hidden"
          )}
        >
          <motion.div
            animate={{ height: expanded ? "auto" : COLLAPSED_HEIGHT, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className={cn("space-y-1.5 overflow-hidden", expanded && !nearBottom && "mask-fade-y")}
          >
            {visible.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} active={active === rec.id} onSelect={() => setActive(rec.id)} />
            ))}
          </motion.div>
        </div>

        <AnimatePresence>
          {expanded && !nearBottom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-card/95 to-transparent"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <p className="text-[10px] text-muted-foreground">
          {expanded ? "Showing all 13 ranked recommendations" : `${visible.length} of ${RECOMMENDATIONS.length} shown`}
        </p>
        <button
          type="button"
          onClick={() => {
            setExpanded((e) => !e);
            setNearBottom(false);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
    </div>
  );
}