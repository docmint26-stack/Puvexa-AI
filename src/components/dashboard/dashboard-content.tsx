"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { AnimatedCounter, Reveal } from "@/components/shared/motion";
import { CaseRow } from "@/components/shared/case-card";
import { TokenBadge } from "@/components/shared/token-badge";
import { PageHeader } from "@/components/shared/page-header";
import { InsightCard } from "@/components/dashboard/insight-card";
import { kpis, nextActions } from "@/lib/data";
import { useCurrentUser, useCases, useRewards, useLeaderboard, useContributions } from "@/lib/hooks";
import { useGuestStore } from "@/lib/state/guest";
import { stagger, fadeUp } from "@/lib/motion";
import { avatarGradient } from "@/lib/format";
import { GuestDashboardContent } from "@/components/dashboard/guest-dashboard-content";

const KPI_ACCENTS: Record<string, string> = {
  "circle-check": "text-success bg-success/10 border-success/20",
  coins: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20",
  gauge: "text-violet-300 bg-violet-500/10 border-violet-300/20",
  sparkles: "text-amber-300 bg-amber-400/10 border-amber-300/20",
  wallet: "text-rose-300 bg-rose-400/10 border-rose-300/20",
  trophy: "text-yellow-300 bg-yellow-400/10 border-yellow-300/20",
};

export function DashboardContent() {
  const user = useCurrentUser();
  const recent = useCases().slice(0, 4);
  const rewards = useRewards();
  const leaderboard = useLeaderboard();
  const topContributors = leaderboard.slice(0, 5);
  const { mine: myContributions } = useContributions();

  const kpiValues = React.useMemo(
    () =>
      kpis.map((k) => {
        if (k.id === "k-2") return { ...k, value: rewards.balance };
        if (k.id === "k-3") return { ...k, value: rewards.claimable };
        if (k.id === "k-1") return { ...k, value: user?.casesResolved ?? k.value };
        if (k.id === "k-4") return { ...k, value: user?.contributions ?? k.value };
        return k;
      }),
    [rewards.balance, rewards.claimable, user?.casesResolved, user?.contributions]
  );

  if (useGuestStore.getState().mode === "guest") return <GuestDashboardContent />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title={
          <>
            {greeting}, <span className="text-gradient-strong">{user?.name.split(" ")[0] ?? "there"}</span>
          </>
        }
        subtitle="Your AI troubleshooting workspace. Diagnose, verify, contribute, and earn FIX."
        action={
          <Button render={<Link href="/diagnose" />}>
            <SparklesIcon /> New Diagnosis
          </Button>
        }
      />

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

      {/* Recent diagnoses + contributions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.05} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Diagnoses</CardTitle>
                  <CardDescription>Latest cases tracked in your workspace</CardDescription>
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
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Contributions</CardTitle>
                  <CardDescription>Fixes you authored</CardDescription>
                </div>
                <CardAction>
                  <Button size="sm" variant="ghost" render={<Link href="/contribute" />}>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {myContributions.slice(0, 4).map((con) => (
                <div
                  key={con.id}
                  className="group rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/25"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium leading-snug text-foreground">{con.title}</p>
                    <TokenBadge value={con.reward} signed />
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Icon name="git-branch" className="size-3" /> reused {con.reuseCount.toLocaleString()}×
                    </span>
                    <span className="flex items-center gap-1 text-cyan-300">
                      <Icon name="coins" className="size-3" /> {con.royalty} FIX royalties
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Rewards snapshot + leaderboard + next actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-400/10 blur-3xl" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rewards Snapshot</CardTitle>
                  <CardDescription>Earning & staking overview</CardDescription>
                </div>
                <CardAction>
                  <Button size="sm" variant="ghost" render={<Link href="/rewards" />}>
                    Manage <ArrowRight className="size-3.5" />
                  </Button>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <RewardStat label="Balance" value={rewards.balance} icon="coins" tone="cyan" />
                <RewardStat label="Claimable" value={rewards.claimable} icon="wallet" tone="rose" />
                <RewardStat label="Royalties" value={rewards.royalty} icon="trending-up" tone="violet" />
                <RewardStat label="Staked" value={rewards.staked} icon="vault" tone="emerald" />
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground">Earnings · last 8 weeks</p>
                  <p className="text-[11px] text-success">+18% vs last period</p>
                </div>
                <div className="flex h-24 items-end gap-1.5 rounded-lg border border-border/60 bg-muted/15 p-3">
                  {[40, 62, 55, 78, 66, 90, 74, 96].map((h, i) => (
                    <div key={i} className="group flex flex-1 flex-col justify-end">
                      <div
                        className={cn(
                          "w-full rounded-t-md bg-linear-to-t transition-all group-hover:opacity-90",
                          i === 7
                            ? "from-cyan-500/60 to-violet-500/80"
                            : "from-foreground/15 to-foreground/5"
                        )}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
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
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50",
                    entry.isYou && "bg-primary/10 ring-1 ring-primary/20"
                  )}
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
                    <p className="truncate text-xs font-medium text-foreground">
                      {entry.name}
                      {entry.isYou && <span className="ml-1 text-[10px] font-semibold text-primary">(you)</span>}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-cyan-300">
                    {entry.fixEarned.toLocaleString()}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="pt-1 text-center">
                <Button size="xs" variant="ghost" render={<Link href="/leaderboard" />}>
                  Full leaderboard <ArrowRight className="size-3" />
                </Button>
              </div>
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
          <div className="grid gap-3 sm:grid-cols-3">
            {nextActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30",
                  action.tone === "accent" && "hover:border-cyan-300/40",
                  action.tone === "success" && "hover:border-success/40"
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg border",
                    action.tone === "primary" && "border-primary/25 bg-primary/10 text-primary",
                    action.tone === "accent" && "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
                    action.tone === "success" && "border-success/25 bg-success/10 text-success"
                  )}
                >
                  <Icon name={action.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{action.title}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function SparklesIcon() {
  return <Icon name="sparkles" className="size-4" />;
}

function RewardStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone: "cyan" | "rose" | "violet" | "emerald";
}) {
  const tones = {
    cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
    rose: "border-rose-300/25 bg-rose-400/10 text-rose-300",
    violet: "border-violet-300/25 bg-violet-500/10 text-violet-300",
    emerald: "border-success/25 bg-success/10 text-success",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={cn("grid size-5 place-items-center rounded-md border", tones[tone])}>
          <Icon name={icon} className="size-3" />
        </span>
        {label}
      </div>
      <p className="mt-2 font-heading text-xl font-semibold tracking-tight text-foreground">
        {value.toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">FIX</span>
      </p>
    </div>
  );
}