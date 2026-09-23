"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Coins, Loader2, Lock, Search, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { TokenBadge } from "@/components/shared/token-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StakeDialog } from "@/components/web3/stake-dialog";
import { useContributions } from "@/lib/hooks";
import { useWeb3Identity } from "@/lib/hooks/web3";
import { useGuestStore } from "@/lib/state/guest";
import { notify } from "@/lib/feedback";
import type { ContributionTask } from "@/lib/demo/types";

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: "border-success/25 bg-success/10 text-success",
  Moderate: "border-warning/25 bg-warning/10 text-warning",
  Expert: "border-amber-400/25 bg-amber-400/10 text-amber-400",
};

const URGENCY_STYLE: Record<string, string> = {
  Low: "text-muted-foreground",
  Medium: "text-warning",
  High: "text-destructive",
};

const TYPE_STYLE: Record<string, string> = {
  fix: "border-primary/25 bg-primary/10 text-primary",
  verify: "border-violet-300/25 bg-violet-500/10 text-violet-300",
  improve: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
};

export function ContributeContent() {
  const { tasks, mine, submit } = useContributions();
  const { demo } = useWeb3Identity();
  const isGuest = useGuestStore((s) => s.mode === "guest");
  const openAuthGate = useGuestStore((s) => s.openAuthGate);
  const [filter, setFilter] = React.useState<string>("All");
  const [query, setQuery] = React.useState("");
  const [activeTask, setActiveTask] = React.useState<ContributionTask | null>(null);
  const [committing, setCommitting] = React.useState(false);
  const [stakeTarget, setStakeTarget] = React.useState<{ id: string; title: string; stake: number } | null>(null);

  const royalties = mine.reduce((s, c) => s + c.royalty, 0);
  const reuses = mine.reduce((s, c) => s + c.reuseCount, 0);

  const filtered = tasks.filter((t) => {
    const fOk = filter === "All" || t.difficulty === filter;
    const qOk =
      !query.trim() ||
      t.title.toLowerCase().includes(query.trim().toLowerCase()) ||
      t.category.toLowerCase().includes(query.trim().toLowerCase());
    return fOk && qOk;
  });

  const onCommit = async () => {
    if (!activeTask) return;
    if (isGuest) {
      setActiveTask(null);
      openAuthGate(
        "Create an account to contribute. Committing moves a real FIX stake, which a guest session is not allowed to do."
      );
      return;
    }
    setCommitting(true);
    const res = await submit({
      type: activeTask.type,
      title: activeTask.title,
      description: activeTask.description,
      steps: [],
      environment: "Windows 11 · Demo",
      stake: activeTask.stake,
    });
    setCommitting(false);
    setActiveTask(null);
    if (demo) {
      notify.success("Contribution submitted", `Ref #${res.id.slice(-6)} · stake held until verified.`);
      return;
    }
    setStakeTarget({ id: res.id, title: activeTask.title, stake: activeTask.stake });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contributions"
        title="Contribute Fixes"
        subtitle="Pick an open problem, submit a verified walkthrough, and earn FIX when others reuse it."
        action={
          <div className="flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2">
            <Coins className="size-4 text-cyan-300" />
            <span className="text-xs font-semibold text-foreground">
              {royalties.toLocaleString()} FIX in royalties
            </span>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: "file-warning", title: "Pick an open case", desc: "Tasks list real problems awaiting verified fixes.", tone: "violet" },
          { icon: "lock", title: "Stake to commit", desc: "A small stake keeps contributions honest and curated.", tone: "amber" },
          { icon: "coins", title: "Earn royalties", desc: "Every verified reuse pays you a royalty slice forever.", tone: "cyan" },
        ].map((s) => (
          <div key={s.title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg border",
                s.tone === "violet" && "border-violet-300/25 bg-violet-500/10 text-violet-300",
                s.tone === "amber" && "border-amber-300/25 bg-amber-400/10 text-amber-300",
                s.tone === "cyan" && "border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
              )}
            >
              <Icon name={s.icon} className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {["All", "Easy", "Moderate", "Expert"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/70 bg-muted/20 text-muted-foreground hover:border-primary/40"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 w-52 rounded-lg border border-border/70 bg-muted/20 pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.04 }}
              className="group flex flex-col rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", DIFFICULTY_STYLE[task.difficulty])}>
                  {task.difficulty}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize", TYPE_STYLE[task.type])}>
                  {task.type} task
                </span>
                <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  proof: {task.verificationNeeded}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{task.title}</p>
              <p className="mt-1.5 line-clamp-3 flex-1 text-xs text-muted-foreground">{task.description}</p>

              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon name="files" className="size-3" /> {task.casesAwaiting} awaiting
                </span>
                <span className={cn("flex items-center gap-1", URGENCY_STYLE[task.urgency])}>
                  <Icon name="flame" className="size-3" /> {task.urgency} urgency
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="shield-check" className="size-3" /> {task.confidenceNeeded}% conf.
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Reward</p>
                  <p className="font-heading text-sm font-semibold text-cyan-300">
                    {task.rewardMin}–{task.rewardMax} FIX
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                    <Lock className="size-3" /> stake {task.stake} FIX
                  </p>
                </div>
              </div>

              <Button size="sm" className="mt-3 w-full" onClick={() => setActiveTask(task)}>
                View & commit <ArrowRight className="size-3.5" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title="No tasks match"
          description="Try a different difficulty filter or search term."
        />
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">My contributions</p>
            <Badge variant="secondary" className="text-[10px]">{mine.length} published</Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">
            <TrendingUp className="mr-1 inline size-3 text-success" />
            {reuses.toLocaleString()} total reuses
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mine.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5 transition-colors hover:border-primary/25">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{c.category} · verified {c.verifiedAt}</p>
                </div>
                <TokenBadge value={c.reward} signed />
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.fix}</p>
              <div className="mt-3 flex flex-wrap gap-4 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon name="git-branch" className="size-3" /> reused {c.reuseCount.toLocaleString()}×
                </span>
                <span className="flex items-center gap-1 text-cyan-300">
                  <Icon name="coins" className="size-3" /> {c.royalty.toLocaleString()} royalties
                </span>
                <span className={cn("flex items-center gap-1", c.status === "Verified" ? "text-success" : "text-warning")}>
                  <Icon name={c.status === "Verified" ? "check-circle" : "clock"} className="size-3" /> {c.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={activeTask !== null} onOpenChange={(open) => !open && setActiveTask(null)}>
        <DialogContent className="sm:max-w-md">
          {activeTask && (
            <>
              <DialogHeader>
                <DialogTitle>{activeTask.title}</DialogTitle>
                <DialogDescription>
                  Commit to verifying a fix for this open case. Your stake is returned when the fix is verified.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium text-foreground">{activeTask.category}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                  <span className="text-muted-foreground">Difficulty</span>
                  <span className={cn("font-medium", activeTask.difficulty === "Easy" ? "text-success" : activeTask.difficulty === "Moderate" ? "text-warning" : "text-amber-400")}>
                    {activeTask.difficulty}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                  <span className="text-muted-foreground">Cases awaiting</span>
                  <span className="font-medium text-foreground">{activeTask.casesAwaiting.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                  <span className="text-muted-foreground">Proof required</span>
                  <span className="font-medium text-foreground">{activeTask.verificationNeeded}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-muted-foreground">Your stake</span>
                  <span className="font-semibold text-amber-300">-{activeTask.stake} FIX (refunded)</span>
                </div>
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-muted-foreground">Potential reward</span>
                  <span className="font-semibold text-cyan-300">{activeTask.rewardMin}–{activeTask.rewardMax} FIX</span>
                </div>
              </div>

              <DialogFooter showCloseButton>
                <Button size="sm" variant="secondary" onClick={() => setActiveTask(null)} disabled={committing}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onCommit} disabled={committing}>
                  {committing ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                  {committing ? "Submitting…" : "Commit & stake"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <StakeDialog
        open={stakeTarget !== null}
        onOpenChange={(open) => !open && setStakeTarget(null)}
        contributionId={stakeTarget?.id ?? ""}
        title={stakeTarget?.title ?? ""}
        requiredStakeWei={BigInt(Math.round((stakeTarget?.stake ?? 0) * 1e18))}
        onLocked={() => {
          setStakeTarget(null);
          notify.success("Stake locked", "Your stake now backs this contribution until it is verified.");
        }}
      />
    </div>
  );
}