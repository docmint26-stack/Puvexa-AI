"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, UserPlus2 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { AnimatedCounter, Reveal } from "@/components/shared/motion";
import { CaseRow } from "@/components/shared/case-card";
import { PageHeader } from "@/components/shared/page-header";
import { InsightCard } from "@/components/dashboard/insight-card";
import { useCases, useLeaderboard, useGuestScoreboard } from "@/lib/hooks";
import { useGuestStore } from "@/lib/state/guest";
import {
  GUEST_AI_RUNS_LIMIT,
  guestNextActions,
  guestRewardSections,
  guestStats,
} from "@/lib/demo/guest";
import { stagger, fadeUp } from "@/lib/motion";
import { avatarGradient } from "@/lib/format";

const KPI_ACCENTS: Record<string, string> = {
  "circle-check": "text-success bg-success/10 border-success/20",
  coins: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20",
  cpu: "text-violet-300 bg-violet-500/10 border-violet-300/20",
  sparkles: "text-amber-300 bg-amber-400/10 border-amber-300/20",
  trophy: "text-yellow-300 bg-yellow-400/10 border-yellow-300/20",
  "trending-up": "text-emerald-300 bg-emerald-400/10 border-emerald-300/20",
};

export function GuestDashboardContent() {
  const { points, aiRunsUsed, stats } = useGuestScoreboard();
  const openAuthGate = useGuestStore((s) => s.openAuthGate);
  const recent = useCases().slice(0, 4);
  const leaderboard = useLeaderboard();
  const topContributors = leaderboard.slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const aiRunsLeft = Math.max(0, GUEST_AI_RUNS_LIMIT - aiRunsUsed);

  const kpiValues = React.useMemo(
    () =>
      guestStats.map((k) => {
        if (k.id === "g-2") return { ...k, value: stats.diagnoses };
        if (k.id === "g-4") return { ...k, value: points };
        if (k.id === "g-6") return { ...k, value: stats.knowledgeImpact };
        if (k.id === "g-3") return { ...k, value: stats.verifiedOutcomes };
        return k;
      }),
    [stats.diagnoses, stats.verifiedOutcomes, stats.knowledgeImpact, points]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Guest workspace"
        title={
          <>
            {greeting}, <span className="text-gradient-strong">Guest</span>
          </>
        }
        subtitle="Explore Puvexa end to end — diagnose, preview fixes, and see how rewards work. Everything is local and free."
        action={
          <Button render={<Link href="/diagnose" />}>
            <Icon name="sparkles" className="size-4" /> New Diagnosis
          </Button>
        }
      />

      {/* Save-progress banner */}
      <div className="flex flex-col items-start gap-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 sm:flex-row sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-violet-400/25 bg-violet-400/10 text-violet-300">
          <UserPlus2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Want to keep what you explore?</p>
          <p className="text-[11px] text-muted-foreground">
            Your journey is saved on this device. Create a free account to keep it and start earning real FIX.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => openAuthGate("Create an account to keep your guest progress.")}>
          Create account <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* KPI grid */}
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {kpiValues.map((kpi) => {
          const accent = KPI_ACCENTS[kpi.icon] ?? "border-border bg-muted/40 text-muted-foreground";
          return (
            <motion.div
              key={kpi.id}
              variants={fadeUp}
              className="group rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
                <span className={cn("grid size-8 place-items-center rounded-lg border", accent)}>
                  <Icon name={kpi.icon} className="size-3.5" />
                </span>
              </div>
              <p className="mt-2.5 font-heading text-2xl font-semibold tracking-tight text-foreground">
                <AnimatedCounter value={kpi.value} suffix={kpi.suffix} />
              </p>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-[11px]",
                  kpi.trend === "up" ? "text-success" : "text-muted-foreground"
                )}
              >
                {kpi.trend === "up" && <TrendingUp className="size-3" />}
                {kpi.delta}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* AI insight */}
      <Reveal>
        <InsightCard />
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.05} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Explore Sample Cases</CardTitle>
                  <CardDescription>Real problems, sample data — open one to watch Puvexa work</CardDescription>
                </div>
                <CardAction>
                  <Button size="sm" variant="ghost" render={<Link href="/cases" />}>
                    View all <ArrowRight className="size-3.5" />
                  </Button>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recent.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
              {recent.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No cases yet. Start a diagnosis on the right.
                </p>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>Rewards Preview</CardTitle>
              <CardDescription>How the FIX economy works</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {guestRewardSections.slice(0, 3).map((section) => (
                <div key={section.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <Icon name={section.icon} className="size-3.5 text-violet-300" />
                    <p className="text-xs font-medium text-foreground">{section.title}</p>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{section.preview}</p>
                </div>
              ))}
              <Button size="sm" variant="ghost" className="w-full" render={<Link href="/rewards" />}>
                See full rewards preview <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-violet-400/10 blur-3xl" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Lab Quota</CardTitle>
                  <CardDescription>Free runs included for guests</CardDescription>
                </div>
                <CardAction>
                  <Badge variant="secondary">{aiRunsLeft} of {GUEST_AI_RUNS_LIMIT} left</Badge>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-end justify-between">
                <p className="text-[11px] text-muted-foreground">Runs used this session</p>
                <p className="text-[11px] text-success">{aiRunsUsed}/{GUEST_AI_RUNS_LIMIT}</p>
              </div>
              <div className="flex h-3 items-center gap-1.5">
                {Array.from({ length: GUEST_AI_RUNS_LIMIT }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-full flex-1 rounded-full",
                      i < aiRunsUsed ? "bg-linear-to-r from-violet-500/70 to-cyan-400/70" : "bg-muted/40"
                    )}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Upload a log or paste a problem, and Puvexa ranks verified fixes. When your runs run out, create an
                account to keep going.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                render={<Link href="/lab" />}
              >
                <Icon name="flask-conical" className="size-3.5" /> Open AI Lab
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leaderboard</CardTitle>
                  <CardDescription>This week&apos;s top fixers</CardDescription>
                </div>
                <CardAction>
                  <Button size="sm" variant="ghost" render={<Link href="/leaderboard" />}>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {topContributors.map((entry) => (
                <div
                  key={entry.handle}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50"
                >
                  <span
                    className={cn(
                      "w-5 text-center font-heading text-xs font-semibold",
                      entry.rank === 1 && "text-yellow-300",
                      entry.rank === 2 && "text-slate-300",
                      entry.rank === 3 && "text-amber-500",
                      entry.rank > 3 && "text-muted-foreground"
                    )}
                  >
                    {entry.rank}
                  </span>
                  <Avatar size="sm">
                    <AvatarFallback
                      className={cn("bg-linear-to-br text-[10px] text-white", avatarGradient(entry.handle))}
                    >
                      {entry.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{entry.name}</p>
                  </div>
                  <span className="text-xs font-semibold text-cyan-300">{entry.fixEarned.toLocaleString()}</span>
                </div>
              ))}
              <Separator />
              <p className="px-2 pt-2 text-center text-[10px] text-muted-foreground">
                Guests don&apos;t rank — create an account to climb the board.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Next actions */}
      <Reveal>
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recommended next steps
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {guestNextActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="group flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-lg border",
                    action.tone === "primary" && "border-primary/25 bg-primary/10 text-primary",
                    action.tone === "accent" && "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
                    action.tone === "success" && "border-success/25 bg-success/10 text-success",
                    action.tone === "violet" && "border-violet-300/25 bg-violet-400/10 text-violet-300"
                  )}
                >
                  <Icon name={action.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{action.title}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{action.description}</p>
                </div>
                <span className="text-xs font-medium text-primary">{action.action}</span>
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="rounded-xl border border-border/70 bg-card/60 p-5 text-center">
          <p className="text-sm font-medium text-foreground">Ready to go further?</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            Earn real FIX, rank on the leaderboard, and stake to a wallet you own.
          </p>
          <Button size="sm" className="mt-3" onClick={() => openAuthGate()}>
            <UserPlus2 className="size-4" /> Create free account
          </Button>
        </div>
      </Reveal>
    </div>
  );
}