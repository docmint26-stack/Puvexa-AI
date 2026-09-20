"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/lib/hooks";
import { useClaimFlow, useWeb3Identity } from "@/lib/hooks/web3";
import { NetworkBadge } from "./network-badge";
import { explorerTxUrl } from "@/lib/web3/config";
import { shortHash, weiToFixed } from "@/lib/web3/mappers";

export interface ClaimableReward {
  id: string;
  amount: number;
}

const STEP_LABELS: Record<string, { title: string; hint: string }> = {
  preparing: { title: "Preparing authorized claim", hint: "Puvexa signs a one-time EIP-712 claim for exactly this reward amount." },
  awaiting_wallet: { title: "Confirm in your wallet", hint: "Open your wallet and approve the claim. The distributor pays only pre-authorized rewards." },
  submitting: { title: "Submitting transaction", hint: "Broadcasting the settlement transaction to the network." },
  waiting_chain: { title: "Waiting for block confirmation", hint: "Puvexa re-verifies the on-chain event before settling." },
  confirming: { title: "Confirming with Puvexa", hint: "Independent chain verification of the payout." },
  confirmed: { title: "Claim paid", hint: "The reward is now on-chain in your wallet." },
  expired: { title: "Claim signature expired", hint: "The signer-issued deadline passed. Try again to receive a fresh signature." },
  failed: { title: "Claim failed", hint: "See the error below. Nothing was moved." },
};

export function ClaimFlowDialog({
  open,
  onOpenChange,
  rewards,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewards: ClaimableReward[];
  onSettled?: () => void;
}) {
  const { state: wallet } = useWallet();
  const { config, demo } = useWeb3Identity();
  const { state, start, reset } = useClaimFlow();

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const canClaim = !demo && config.enabled && wallet.status === "verified" && wallet.address;
  const busy = ["preparing", "awaiting_wallet", "submitting", "waiting_chain", "confirming"].includes(state.step);

  const run = async (reward: ClaimableReward) => {
    if (!wallet.address) return;
    await start(reward.id, wallet.address, config.chainId);
    onSettled?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Claim on-chain rewards <NetworkBadge />
          </DialogTitle>
          <DialogDescription>
            Claiming moves approved FIX rewards to {wallet.shortAddress ?? "your wallet"} on the network above. Claiming never
            invents amounts — Puvexa signs exactly what your reward ledger authorizes.
          </DialogDescription>
        </DialogHeader>

        {!demo && !config.enabled && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Web3 is not configured. Set NEXT_PUBLIC_WEB3_* to enable on-chain claiming.
          </div>
        )}
        {!demo && config.enabled && !canClaim && (
          <div className="flex items-start gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs text-muted-foreground">
            <Wallet className="mt-0.5 size-3.5 shrink-0" />
            Connect and verify your wallet before claiming.
          </div>
        )}

        <div className="space-y-2">
          {rewards.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No claimable rewards right now.</p>
          )}
          {rewards.map((reward) => {
            const isBusy = busy && state.prepared?.reward_id === reward.id;
            const isDone = state.step === "confirmed" && state.prepared?.reward_id === reward.id;
            return (
              <Card key={reward.id} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                    isDone ? "border-success/40 bg-success/10 text-success" : "border-primary/25 bg-primary/10 text-primary"
                  }`}>
                    {isDone ? <CheckCircle2 className="size-4" /> : <Lock className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{reward.amount.toLocaleString()} FIX</p>
                    <p className="text-[11px] text-muted-foreground">Authorized reward · single-use signature</p>
                  </div>
                  <Button size="sm" disabled={!canClaim || busy || isDone} onClick={() => void run(reward)}>
                    {isDone ? "Claimed" : isBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Claim"}
                  </Button>
                </CardContent>
                {state.prepared?.reward_id === reward.id && state.step !== "idle" && (
                  <div className="border-t border-border/60 bg-muted/30 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      {busy ? <Loader2 className="size-3.5 animate-spin text-primary" /> : state.step === "confirmed" ? <CheckCircle2 className="size-3.5 text-success" /> : <AlertTriangle className="size-3.5 text-warning" />}
                      {STEP_LABELS[state.step]?.title ?? state.step}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {STEP_LABELS[state.step]?.hint ?? ""}
                    </p>
                    {state.amountWei && state.step === "confirmed" && (
                      <p className="mt-1 font-mono text-[11px] text-success">{weiToFixed(state.amountWei)} FIX paid</p>
                    )}
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
                    {state.error && <p className="mt-1 text-[11px] text-destructive">{state.error}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}