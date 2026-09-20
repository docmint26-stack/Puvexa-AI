"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Landmark, Loader2, LockKeyhole, ShieldCheck, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/lib/hooks";
import { useStakeFlow, useWeb3Identity } from "@/lib/hooks/web3";
import { NetworkBadge } from "./network-badge";
import { explorerTxUrl, explorerAddressUrl } from "@/lib/web3/config";
import { shortAddress } from "@/lib/format";
import { shortHash, weiToFixed } from "@/lib/web3/mappers";

const STEP_LABELS: Record<string, { title: string; hint: string }> = {
  idle: { title: "Ready to stake", hint: "Your stake is locked in the vault as accountability for this contribution." },
  checking: { title: "Checking allowance", hint: "Confirming the vault can hold your FIX for this contribution." },
  approval_required: { title: "Approve tokens in your wallet", hint: "Approves exactly the stake amount so the vault can lock it." },
  approving: { title: "Submitting approval", hint: "Broadcasting the token approval for exactly your stake amount." },
  ready: { title: "Allowance ready", hint: "Approval confirmed. Now confirm the stake transfer." },
  staking: { title: "Locking stake", hint: "Broadcasting the vault stake transaction." },
  confirming: { title: "Confirming with Puvexa", hint: "Independent chain verification of your stake." },
  locked: { title: "Stake locked", hint: "Your stake backs this contribution until it is verified." },
  failed: { title: "Stake failed", hint: "See the error below. Nothing was moved." },
};

export function StakeDialog({
  open,
  onOpenChange,
  contributionId,
  title,
  requiredStakeWei,
  onLocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributionId: string;
  title: string;
  requiredStakeWei: bigint;
  onLocked?: () => void;
}) {
  const { state: wallet } = useWallet();
  const { config, demo } = useWeb3Identity();
  const { state, start, reset } = useStakeFlow();

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  React.useEffect(() => {
    if (open && state.step === "locked") onLocked?.();
  }, [open, state.step, onLocked]);

  const canStake =
    !demo &&
    config.enabled &&
    wallet.status === "verified" &&
    wallet.address &&
    Boolean(config.tokenAddress) &&
    Boolean(config.stakeVaultAddress);

  const busy = !["idle", "locked", "failed"].includes(state.step);
  const info = STEP_LABELS[state.step] ?? STEP_LABELS.idle;

  const run = async () => {
    if (!wallet.address || !config.tokenAddress || !config.stakeVaultAddress) return;
    await start({
      contributionId,
      amountWei: requiredStakeWei,
      owner: wallet.address as `0x${string}`,
      tokenAddress: config.tokenAddress as `0x${string}`,
      vaultAddress: config.stakeVaultAddress as `0x${string}`,
      chainId: config.chainId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Accountability stake <NetworkBadge />
          </DialogTitle>
          <DialogDescription>
            Staking locks FIX that backs your contribution being judged by {title || "this contribution"}. No yield is paid —
            the stake is returned when the contribution is verified, or slashed if it is reversed.
          </DialogDescription>
        </DialogHeader>

        {!demo && !config.enabled && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Web3 is not configured. Set NEXT_PUBLIC_WEB3_* to enable on-chain staking.
          </div>
        )}
        {!demo && config.enabled && !canStake && (
          <div className="flex items-start gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs text-muted-foreground">
            <Wallet className="mt-0.5 size-3.5 shrink-0" />
            Connect and verify your wallet before staking.
          </div>
        )}
        {demo && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-300">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
            Demo staking is simulated and never touches a network.
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">Contribution</span>
            <span className="max-w-[55%] truncate font-medium text-foreground">{title || contributionId}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">Required stake</span>
            <span className="font-semibold text-amber-300">
              {weiToFixed(requiredStakeWei)} FIX
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono text-foreground">{wallet.shortAddress ?? "not connected"}</span>
          </div>
          {config.stakeVaultAddress && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
              <span className="text-muted-foreground">On-chain address</span>
              <a
                href={explorerAddressUrl(config.stakeVaultAddress) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
              >
                {shortAddress(config.stakeVaultAddress)} <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {state.step !== "idle" && state.step !== "locked" && state.step !== "failed" && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" /> {info.title}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{info.hint}</p>
              {state.txHash && (
                <a
                  href={explorerTxUrl(state.txHash) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                >
                  {shortHash(state.txHash)} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}

          {state.step === "locked" && (
            <div className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/10 p-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <div>
                <p className="text-xs font-semibold text-foreground">Stake locked for {contributionId.slice(0, 8)}…</p>
                <p className="text-[11px] text-muted-foreground">{info.hint}</p>
                {state.txHash && (
                  <a
                    href={explorerTxUrl(state.txHash) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                  >
                    {shortHash(state.txHash)} <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {state.step === "failed" && state.error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <X className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{state.error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button size="sm" onClick={() => void run()} disabled={!canStake || busy || state.step === "locked"}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : state.step === "locked" ? <ShieldCheck className="size-3.5" /> : <Landmark className="size-3.5" />}
            {state.step === "locked" ? "Stake locked" : state.step === "failed" ? "Try again" : `Stake ${weiToFixed(requiredStakeWei)} FIX`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}