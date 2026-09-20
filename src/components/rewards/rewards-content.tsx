"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  ExternalLink,
  Landmark,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Unlock,
  Vault,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { TokenBadge } from "@/components/shared/token-badge";
import { AnimatedCounter } from "@/components/shared/motion";
import { PageHeader } from "@/components/shared/page-header";
import { WalletPanel } from "@/components/web3/wallet-panel";
import { NetworkBadge } from "@/components/web3/network-badge";
import { ClaimFlowDialog, type ClaimableReward } from "@/components/web3/claim-flow-dialog";
import { OnChainHistory } from "@/components/web3/onchain-history";
import { useRewards, useWallet } from "@/lib/hooks";
import { useWeb3Identity } from "@/lib/hooks/web3";
import { notify } from "@/lib/feedback";
import type { RewardItem } from "@/lib/demo/types";

const TYPE_STYLE: Partial<Record<RewardItem["type"], string>> = {
  "Verified Outcome": "border-success/25 bg-success/10 text-success",
  "Useful Fix": "border-primary/25 bg-primary/10 text-primary",
  Royalty: "border-violet-300/25 bg-violet-500/10 text-violet-300",
  "Reward Share": "border-success/25 bg-success/10 text-success",
  "Crowd Verification": "border-amber-300/25 bg-amber-400/10 text-amber-300",
  Staked: "border-amber-300/25 bg-amber-400/10 text-amber-300",
  Claimed: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
  Earned: "border-primary/25 bg-primary/10 text-primary",
};

export function RewardsContent() {
  const router = useRouter();
  const { balance, claimable, lifetimeEarned, royalty, staked, history, transactions, breakdown, claim, confirmClaim, stake, unstake } = useRewards();
  const { state: wallet, disconnect } = useWallet();
  const { demo } = useWeb3Identity();

  const [claiming, setClaiming] = React.useState(false);
  const [stakeOpen, setStakeOpen] = React.useState(false);
  const [stakeAmount, setStakeAmount] = React.useState(20);
  const [claimDialogOpen, setClaimDialogOpen] = React.useState(false);
  const [claimableRewards, setClaimableRewards] = React.useState<ClaimableReward[]>([]);

  const walletDisconnected = wallet.status === "disconnected" || wallet.status === "error";

  const claimableFromHistory = React.useMemo(() => {
    if (demo) return [];
    return history.filter((r) => r.status === "unlocked" && r.id).map((r) => ({ id: r.id, amount: r.amount }));
  }, [demo, history]);

  const onClaim = () => {
    if (claimable <= 0) return;
    if (demo) {
      setClaiming(true);
      window.setTimeout(() => {
        const res = claim();
        confirmClaim(res.txId);
        setClaiming(false);
        notify.success("Rewards claimed", `+${res.claimed.toLocaleString()} FIX moved to your balance.`);
      }, 1400);
      return;
    }
    setClaimableRewards(claimableFromHistory.length > 0 ? claimableFromHistory : []);
    setClaimDialogOpen(true);
  };

  const openClaimFor = (reward: ClaimableReward) => {
    setClaimableRewards([reward]);
    setClaimDialogOpen(true);
  };

  const claimDisabled = demo ? claiming || claimable <= 0 : wallet.status !== "verified";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Web3 Economy"
        title="Rewards & Wallet"
        subtitle="FIX is your proof of helpfulness. Earn it off-chain, then claim it on-chain to a wallet you own."
        action={
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2">
            <NetworkBadge />
            <Separator orientation="vertical" className="h-4" />
            <WalletPanel />
          </div>
        }
      />

      {/* Hero balance */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-br from-violet-500/15 via-card/50 to-cyan-400/10 p-6 ring-1 ring-primary/10 sm:p-8">
        <div className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 size-80 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Coins className="size-3.5 text-cyan-300" /> Off-chain balance
            </p>
            <div className="mt-2 flex items-end gap-3">
              <p className="font-heading text-5xl font-bold tracking-tight text-foreground">
                <AnimatedCounter value={balance} />
              </p>
              <p className="pb-1.5 font-heading text-lg font-semibold text-cyan-300">FIX</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {demo ? (
                <>Earned from verified outcomes.{" "}{walletDisconnected ? "Connect a wallet to claim (simulated)." : "Connect and verify before you claim."}</>
              ) : (
                <>
                  FIX earned from verified outcomes stays off-chain until you claim it to a network wallet you own.
                  {!demo && !walletDisconnected && wallet.status !== "verified" && " Verify your wallet below to unlock claiming."}
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="lg" onClick={onClaim} disabled={claimDisabled}>
              {claiming ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Claiming…
                </>
              ) : (
                <>
                  <Unlock className="size-4" /> Claim {claimable.toLocaleString()} FIX
                </>
              )}
            </Button>
            {!walletDisconnected && demo && (
              <Button size="lg" variant="secondary" onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-border/60 pt-5 sm:grid-cols-4">
          <BalancePill icon="trending-up" label="Lifetime earned" value={lifetimeEarned} tone="cyan" />
          <BalancePill icon="coins" label="Royalties" value={royalty} tone="violet" />
          <BalancePill icon="lock" label="Staked" value={staked} tone="amber" />
          <BalancePill icon="wallet" label="Claimable" value={claimable} tone="rose" />
        </div>
      </div>

      {claimable > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Landmark className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {claimable.toLocaleString()} FIX unlocked & ready to claim
            </p>
            <p className="text-[11px] text-muted-foreground">Breakdown: {breakdown.map((b) => `${b.amount} ${b.label}`).join(" · ")}</p>
          </div>
          {demo ? (
            <Button size="sm" onClick={onClaim} disabled={claiming}>
              {claiming ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              {claiming ? "Claiming…" : `Claim ${claimable.toLocaleString()} FIX`}
            </Button>
          ) : (
            <Button size="sm" onClick={onClaim} disabled={wallet.status !== "verified"}>
              {wallet.status !== "verified" ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
              {wallet.status === "verified" ? `Claim ${claimable.toLocaleString()} FIX` : "Verify wallet to claim"}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Accountability staking */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Accountability staking</CardTitle>
                <CardDescription>Back your verified claims. No yield — trust.</CardDescription>
              </div>
              <TokenBadge value={staked} className="text-amber-300" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              Staking locks FIX behind a contribution as a promise it represents a real, verified outcome. It is returned
              when verified, or slashed if reversed — it does not pay interest.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Staked</p>
                <p className="mt-1 font-heading text-xl font-semibold text-amber-300">{staked.toLocaleString()} FIX</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Return</p>
                <p className="mt-1 font-heading text-xl font-semibold text-foreground">100% refunded</p>
              </div>
            </div>
            {demo ? (
              <Dialog open={stakeOpen} onOpenChange={setStakeOpen}>
                <DialogTrigger render={<Button size="sm" className="flex-1"><Landmark className="size-3.5" /> Stake</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Stake into confidence pool</DialogTitle>
                    <DialogDescription>Stake FIX as accountability. Demo simulation only — no yield, no network.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-2 py-2">
                    {[10, 20, 50].map((a) => (
                      <button
                        key={a}
                        onClick={() => setStakeAmount(a)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                          stakeAmount === a
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {a} FIX
                      </button>
                    ))}
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button variant="ghost">Cancel</Button>} />
                    <DialogClose
                      render={
                        <Button
                          onClick={() => {
                            stake(stakeAmount);
                            notify.success("Staked", `${stakeAmount} FIX added to the confidence pool.`);
                          }}
                        >
                          Confirm stake
                        </Button>
                      }
                    />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button size="sm" className="flex-1" variant="secondary" onClick={() => router.push("/contribute")}>
                <Vault className="size-3.5" /> Stake on a contribution
              </Button>
            )}
            {demo && (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={staked <= 0}
                onClick={() => unstake(10)}
              >
                <Vault className="size-3.5" /> Unstake 10
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Off-chain transactions / on-chain activity */}
        <div className="lg:col-span-2">
          {demo ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent transactions</CardTitle>
                    <CardDescription>On testnet — every move is public (simulated).</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    <ShieldCheck className="size-3 text-success" /> tx verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {transactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/25">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg border",
                        tx.kind === "credit"
                          ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
                          : "border-amber-300/25 bg-amber-400/10 text-amber-300"
                      )}
                    >
                      {tx.kind === "credit" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{tx.label}</p>
                      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-mono text-cyan-300/80">{tx.txHash}</span>
                        <ExternalLink className="size-3 opacity-60" />
                        <span className={tx.status === "pending" ? "text-warning" : ""}>
                          · {tx.date} · {tx.status}
                        </span>
                      </p>
                    </div>
                    <span className={cn("font-heading text-sm font-semibold", tx.kind === "credit" ? "text-cyan-300" : "text-amber-300")}>
                      {tx.kind === "credit" ? "+" : "−"}
                      {tx.amount.toLocaleString()} FIX
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <OnChainHistory />
          )}
        </div>
      </div>

      {/* Reward history */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Reward history
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {history.map((r) => {
            const isUnlocked = r.status === "unlocked" && Boolean(r.id);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 ring-1 ring-foreground/5 transition-colors hover:border-primary/25"
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", TYPE_STYLE[r.type] ?? "border-border bg-muted text-muted-foreground")}>
                  <Icon
                    name={
                      r.type === "Staked" ? "lock" : r.type === "Claimed" ? "wallet" : r.type === "Royalty" ? "trending-up" : "coins"
                    }
                    className="size-4"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">{r.type} · {r.date}</p>
                </div>
                <div className="text-right">
                  <p className={cn("font-heading text-sm font-semibold", r.type === "Staked" || r.type === "Claimed" ? "text-amber-300" : "text-cyan-300")}>
                    {r.type === "Staked" || r.type === "Claimed" ? "−" : "+"}
                    {r.amount.toLocaleString()} FIX
                  </p>
                  {r.status === "unlocked" && <p className="text-[10px] text-success">unlocked</p>}
                  {r.status === "pending" && <p className="text-[10px] text-warning">pending</p>}
                  {r.status === "completed" && <p className="text-[10px] text-muted-foreground">on-chain</p>}
                </div>
                {!demo && isUnlocked && (
                  <Button size="xs" variant="outline" onClick={() => openClaimFor({ id: r.id, amount: r.amount })}>
                    <Unlock className="size-3" /> Claim
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-4">
        <SparkleIcon />
        <p className="text-xs text-muted-foreground">
          Earning since the {demo ? "testnet launch" : "verified-outcome"}:{" "}
          <span className="font-semibold text-foreground">{lifetimeEarned.toLocaleString()} FIX</span>
          {" · "}
          {demo ? (
            <>
              Your royalty stream accrued{" "}
              <TrendingUp className="mr-1 inline size-3 text-success" />
              <span className="font-semibold text-success">{royalty.toLocaleString()} FIX</span> from reused fixes alone.
            </>
          ) : (
            <>Royalties accrue from reused, verified fixes and settle on-chain when you claim.</>
          )}
        </p>
      </div>

      {!demo && (
        <ClaimFlowDialog
          open={claimDialogOpen}
          onOpenChange={setClaimDialogOpen}
          rewards={claimableRewards}
        />
      )}
    </div>
  );
}

function SparkleIcon() {
  return <Icon name="sparkles" className="size-5 shrink-0 text-primary" />;
}

function BalancePill({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone: "cyan" | "violet" | "amber" | "rose";
}) {
  const tones = {
    cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
    violet: "border-violet-300/25 bg-violet-500/10 text-violet-300",
    amber: "border-amber-300/25 bg-amber-400/10 text-amber-300",
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
          {value.toLocaleString()} <span className="text-[9px] font-medium text-muted-foreground">FIX</span>
        </p>
      </div>
    </div>
  );
}