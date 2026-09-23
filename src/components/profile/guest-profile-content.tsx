"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { UserPlus2 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { useGuestScoreboard } from "@/lib/hooks";
import { useGuestStore } from "@/lib/state/guest";
import { guestUserView } from "@/lib/demo/guest";
import { avatarGradient, initialsOf } from "@/lib/format";

export function GuestProfileContent() {
  const { points, stats } = useGuestScoreboard();
  const openAuthGate = useGuestStore((s) => s.openAuthGate);
  const user = guestUserView;

  const profileStats = [
    { label: "Cases explored", value: stats.casesExplored, suffix: "" },
    { label: "AI diagnoses", value: stats.diagnoses, suffix: "" },
    { label: "Verified demo outcomes", value: stats.verifiedOutcomes, suffix: "" },
    { label: "Guest Points", value: points, suffix: " pts", tone: "violet" },
    { label: "Rank preview", value: 24, suffix: "", tone: "default" },
    { label: "Knowledge impact", value: stats.knowledgeImpact, suffix: " reuses", tone: "success" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Profile" title="Public profile" subtitle="A guest preview — your reputation starts when you sign up." />

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 ring-1 ring-foreground/5"
      >
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar size="lg" className="size-20">
            <AvatarFallback className={cn("bg-linear-to-br text-2xl text-white", avatarGradient(user.handle))}>
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">{user.name}</h2>
              <span className="text-sm text-muted-foreground">{user.handle}</span>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Icon name="sparkles" className="size-3 text-violet-300" /> Guest Preview
              </Badge>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {user.tagline} Your session is local to this device.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">No wallet</Badge>
              <Badge variant="outline" className="text-[10px]">No FIX balance</Badge>
              <Badge variant="outline" className="text-[10px]">Not on leaderboard</Badge>
            </div>
          </div>

          <div className="flex shrink-0 flex-row gap-4 sm:flex-col sm:items-end">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Rank preview</p>
              <p className="font-heading text-2xl font-bold text-foreground">#{user.rank}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Reputation probe</p>
              <p className="flex items-center justify-end gap-1 font-heading text-2xl font-bold text-violet-300">
                {user.reputation.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-border/60 pt-5 sm:grid-cols-3 lg:grid-cols-6">
          {profileStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className={cn("mt-1 font-heading text-xl font-semibold tracking-tight", s.tone === "violet" ? "text-violet-300" : s.tone === "success" ? "text-success" : "text-foreground")}>
                {s.value.toLocaleString()}
                <span className="text-[9px] font-medium text-muted-foreground">{s.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Earn badges by verifying real fixes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {["Fix Architect", "100-Day Streak", "Community MVP", "Early Adopter"].map((label, i) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground">
                  <Icon name={i === 0 ? "compass" : i === 1 ? "flame" : "trophy"} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">Unlocked by verifying real outcomes</p>
                </div>
                <Icon name="lock" className="size-3.5 text-muted-foreground/50" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ready to build a reputation?</CardTitle>
              <CardDescription>Verified fixes — not claims — earn you rank.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Guests don&apos;t publish or rank. Create an account to author verified walkthroughs, earn FIX, and climb
                the weekly leaderboard.
              </p>
              <Button size="sm" className="w-full" onClick={() => openAuthGate()}>
                <UserPlus2 className="size-3.5" /> Create free account
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>Local preview data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Device storage</span>
                <span className="font-medium text-foreground">Local only</span>
              </div>
              <div className="flex justify-between">
                <span>Wallet</span>
                <span className="font-medium text-foreground">None connected</span>
              </div>
              <div className="flex justify-between">
                <span>Network write</span>
                <span className="font-medium text-foreground">None</span>
              </div>
              <p className="pt-1 text-[10px] text-muted-foreground/70">
                Guest mode never calls protected APIs or moves real value.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}