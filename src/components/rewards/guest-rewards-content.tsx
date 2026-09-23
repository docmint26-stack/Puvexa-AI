"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Coins, ShieldQuestion, Sparkles, UserPlus2 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared/icon";
import { AnimatedCounter } from "@/components/shared/motion";
import { PageHeader } from "@/components/shared/page-header";
import { NetworkBadge } from "@/components/web3/network-badge";
import { useGuestScoreboard } from "@/lib/hooks";
import { useGuestStore } from "@/lib/state/guest";
import {
  GUEST_AI_RUNS_LIMIT,
  guestAccountUnlocks,
  guestRewardSections,
  GUEST_POINTS_SEED,
} from "@/lib/demo/guest";

const SECTION_TONE: Record<string, string> = {
  violet: "border-violet-300/25 bg-violet-400/10 text-violet-300",
  cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
  success: "border-success/25 bg-success/10 text-success",
  amber: "border-amber-300/25 bg-amber-400/10 text-amber-300",
  emerald: "border-emerald-300/25 bg-emerald-400/10 text-emerald-300",
  rose: "border-rose-300/25 bg-rose-400/10 text-rose-300",
};

export function GuestRewardsContent() {
  const { points, aiRunsUsed } = useGuestScoreboard();
  const openAuthGate = useGuestStore((s) => s.openAuthGate);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Guest preview"
        title="Rewards & Wallet"
        subtitle="A preview of how FIX works — Guest Points let you feel the incentives without touching real FIX."
        action={
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2">
            <NetworkBadge />
            <span className="text-[10px] text-muted-foreground">Browse-only preview</span>
          </div>
        }
      />

      {/* Guest points hero */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-linear-to-br from-violet-500/15 via-card/50 to-cyan-400/10 p-6 ring-1 ring-violet-400/10 sm:p-8">
        <div className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-violet-300" /> Guest Points
            </p>
            <div className="mt-2 flex items-end gap-3">
              <p className="font-heading text-5xl font-bold tracking-tight text-foreground">
                <AnimatedCounter value={points} suffix=" pts" />
              </p>
              <Badge variant="secondary" className="mb-1.5 text-[10px]">
                preview only
              </Badge>
            </div>
            <p className="mt-2 max-w-md text-xs text-muted-foreground">
              Guest Points are a local preview of how earning feels — they are not FIX, can&apos;t be claimed, and
              never reach a wallet. Start with {GUEST_POINTS_SEED} pts; earn +10 per diagnosis and +20 per verified
              demo outcome.
            </p>
          </div>
          <Button size="lg" className="shrink-0" onClick={() => openAuthGate("Create an account to start earning real FIX.")}>
            <UserPlus2 className="size-4" /> Start earning FIX
          </Button>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-border/60 pt-5 sm:grid-cols-4">
          <StatsPill icon="cpu" label="AI Lab runs left" value={Math.max(0, GUEST_AI_RUNS_LIMIT - aiRunsUsed)} tone="cyan" suffix=" runs" />
          <StatsPill icon="sparkles" label="Guest Points seeded" value={GUEST_POINTS_SEED} tone="violet" suffix=" pts" />
          <StatsPill icon="shield-check" label="Demo outcomes verified" value={4} tone="success" suffix="" />
          <StatsPill icon="wallet" label="Wallet claims" value={0} tone="rose" suffix=" FIX" />
        </div>
      </div>

      {/* Guard banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-warning/25 bg-warning/5 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
          <ShieldQuestion className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">FIX claiming is locked for guests</p>
          <p className="text-[11px] text-muted-foreground">
            Only an account with a connected wallet can claim on the FIX testnet. Everything below is educational.
          </p>
        </div>
      </div>

      {/* How FIX works */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            How the FIX economy works
          </p>
          <Badge variant="outline" className="text-[10px]">6 concepts</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guestRewardSections.map((section, i) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-border/70 bg-card/60 p-4 ring-1 ring-foreground/5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn("grid size-9 place-items-center rounded-lg border", SECTION_TONE[section.tone])}>
                  <Icon name={section.icon} className="size-4" />
                </span>
                <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{section.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{section.description}</p>
              <p className="mt-2 text-[10px] font-medium text-primary/90">{section.preview}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* What an account unlocks */}
      <RevealBox>
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-4 text-cyan-300" /> What an account unlocks
            </CardTitle>
            <CardDescription>The real economy starts when you sign up.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {guestAccountUnlocks.map((unlock, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/15 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
                    <Icon name={unlock.icon} className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{unlock.title}</p>
                    <p className="text-[11px] text-muted-foreground">{unlock.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-4 w-full" onClick={() => openAuthGate()}>
              Create free account <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </RevealBox>
    </div>
  );
}

function RevealBox({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      {children}
    </motion.div>
  );
}

function StatsPill({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  suffix: string;
  tone: "cyan" | "violet" | "success" | "rose";
}) {
  const tones = {
    cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
    violet: "border-violet-300/25 bg-violet-500/10 text-violet-300",
    success: "border-success/25 bg-success/10 text-success",
    rose: "border-rose-300/25 bg-rose-400/10 text-rose-300",
  };
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 p-3">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", tones[tone])}>
        <Icon name={icon} className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="truncate font-heading text-sm font-semibold text-foreground">
          {value.toLocaleString()}
          <span className="text-[9px] font-medium text-muted-foreground">{suffix}</span>
        </p>
      </div>
    </div>
  );
}