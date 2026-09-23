"use client";

import { motion } from "framer-motion";
import {
  BadgeCheck,
  Flame,
  MapPin,
  Pencil,
  Share2,
  ShieldCheck,
  Mail,
  CalendarDays,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { TokenBadge } from "@/components/shared/token-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCurrentUser, useRewards, useLeaderboard, useWallet, useContributions } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useGuestStore } from "@/lib/state/guest";
import { GuestProfileContent } from "@/components/profile/guest-profile-content";
import { avatarGradient, initialsOf } from "@/lib/format";
import { Reveal } from "@/components/shared/motion";

const ACHIEVEMENTS = [
  { label: "Fix Architect", desc: "250+ fixes verified", icon: "compass", tone: "border-violet-300/25 bg-violet-500/10 text-violet-300" },
  { label: "100-Day Streak", desc: "Verified daily for 100 days", icon: "flame", tone: "border-amber-300/25 bg-amber-400/10 text-amber-300" },
  { label: "Community MVP", desc: "Named top contributor once", icon: "trophy", tone: "border-yellow-300/25 bg-yellow-300/10 text-yellow-300" },
  { label: "Early Adopter", desc: "Joined at testnet launch", icon: "rocket", tone: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300" },
];

export function ProfileContent() {
  const user = useCurrentUser();
  const { lifetimeEarned, royalty } = useRewards();
  const leaderboard = useLeaderboard();
  const { state: wallet } = useWallet();
  const { mine } = useContributions();
  const router = useRouter();

  if (useGuestStore.getState().mode === "guest") return <GuestProfileContent />;

  if (!user) {
    return (
      <EmptyState
        icon="user"
        title="Signed out"
        description="Sign in to view your profile."
        actionLabel="Sign in"
        onAction={() => router.push("/login?next=/profile")}
      />
    );
  }

  const leader = leaderboard.find((e) => e.isYou);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader eyebrow="Profile" title="Public profile" subtitle="Your reputation is built on verified fixes, not claims." />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost"><Pencil className="size-3.5" /> Edit</Button>
          <Button size="sm" variant="secondary"><Share2 className="size-3.5" /> Share profile</Button>
        </div>
      </div>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 ring-1 ring-foreground/5"
      >
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 size-72 rounded-full bg-cyan-400/10 blur-3xl" />

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
              <Badge variant="outline" className="gap-1 text-[10px]"><BadgeCheck className="size-3 text-primary" /> Verified fixer</Badge>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{user.bio}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="size-3" /> {user.location}</span>
              <span className="flex items-center gap-1"><CalendarDays className="size-3" /> Joined {user.memberSince}</span>
              <span className="flex items-center gap-1"><Mail className="size-3" /> {user.email}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.expertise.map((e) => (
                <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-row gap-4 sm:flex-col sm:items-end">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Global rank</p>
              <p className="font-heading text-2xl font-bold text-foreground">#{leader?.rank ?? user.rank}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Reputation</p>
              <p className="flex items-center justify-end gap-1 font-heading text-2xl font-bold text-success">
                <ShieldCheck className="size-4" /> {user.reputation.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-border/60 pt-5 sm:grid-cols-4 lg:grid-cols-6">
          <ProfileStat label="Cases solved" value={user.casesResolved} suffix="" />
          <ProfileStat label="Fixes contributed" value={user.contributions} suffix="" />
          <ProfileStat label="Total earned" value={lifetimeEarned} suffix=" FIX" tone="cyan" />
          <ProfileStat label="Success rate" value={user.successRate} suffix="%" tone="success" />
          <ProfileStat label="Day streak" value={user.streak} suffix="" tone="amber" />
          <ProfileStat label="Verified outcomes" value={user.verifiedOutcomes} suffix="" tone="violet" />
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contributions */}
        <Reveal className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contributions</CardTitle>
                  <CardDescription>Fixes you authored and verified</CardDescription>
                </div>
                <TokenBadge value={royalty} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {mine.length === 0 && (
                <p className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
                  No published contributions yet. Head to <span className="font-semibold text-foreground">Contribute</span> to publish your first fix.
                </p>
              )}
              {mine.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/25">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground">
                    <Icon name={c.category.includes("Network") ? "wifi-off" : "bug"} className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{c.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{c.fix}</p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Icon name="git-branch" className="size-3" /> reused {c.reuseCount.toLocaleString()}×</span>
                      <span className="text-cyan-300">+{c.royalty} royalties</span>
                      <span className={cn(c.status === "Verified" ? "text-success" : "text-warning")}>✓ {c.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>

        {/* Right column */}
        <div className="space-y-6">
          {/* Wallet */}
          <Card>
            <CardHeader>
              <CardTitle>Web3 wallet</CardTitle>
              <CardDescription>Linked to FIX Testnet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                <span className={cn("relative flex size-2", wallet.status === "verified" && "animate-pulse")}>
                  <span className={cn("absolute inline-flex size-full rounded-full opacity-60", wallet.status === "verified" ? "bg-success" : "bg-muted-foreground")} />
                  <span className={cn("relative inline-flex size-2 rounded-full", wallet.status === "verified" ? "bg-success" : "bg-muted-foreground")} />
                </span>
                <span className="text-muted-foreground">
                  {wallet.status === "verified" ? "Connected" : "Not connected"}
                </span>
                <span className={cn("ml-auto font-mono", wallet.status === "verified" ? "text-foreground" : "text-muted-foreground")}>
                  {wallet.shortAddress ?? "0x---…---"}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon name="shield-check" className="size-3.5 text-success" /> Keys stay in your wallet. Puvexa never holds funds.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                render={<a href="/rewards" />}
              >
                {wallet.status === "verified" ? "Manage rewards" : "Connect in Rewards"}
              </Button>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Milestones earned on-chain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", a.tone)}>
                    <Icon name={a.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                  </div>
                  <Badge className="text-[9px]">earned</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Streak */}
          <Card>
            <CardHeader>
              <CardTitle>Verification streak</CardTitle>
              <CardDescription>Keep it alive — submit one verified fix a day.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Flame className="size-6 text-amber-400" />
                <p className="font-heading text-3xl font-bold text-foreground">{user.streak}<span className="text-base font-medium text-muted-foreground"> days</span></p>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-8 flex-1 rounded-md",
                      i < user.streak % 14
                        ? "bg-linear-to-t from-amber-500/50 to-amber-300/80"
                        : i === user.streak % 14
                          ? "border border-dashed border-primary/50"
                          : "bg-foreground/5"
                    )}
                  />
                ))}
              </div>
              <Separator />
              <p className="text-[11px] text-muted-foreground">
                Your weekly multiplier increases with streak length — <span className="font-semibold text-foreground">next reward at day {user.streak + 1}</span>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value, suffix = "", tone = "default" }: { label: string; value: number; suffix?: string; tone?: "default" | "cyan" | "success" | "amber" | "violet" }) {
  const tones = {
    default: "text-foreground",
    cyan: "text-cyan-300",
    success: "text-success",
    amber: "text-amber-300",
    violet: "text-violet-300",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-xl font-semibold tracking-tight", tones[tone])}>
        {value.toLocaleString()}<span className="text-[9px] font-medium text-muted-foreground">{suffix}</span>
      </p>
    </div>
  );
}