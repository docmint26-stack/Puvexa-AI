"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWeb3History, useWeb3Status } from "@/lib/hooks/web3";
import { explorerTxUrl } from "@/lib/web3/config";
import { shortHash, TRANSACTION_TYPE_LABELS } from "@/lib/web3/mappers";

export function OnChainHistory() {
  const { claims, transactions, reload, loading } = useWeb3History();
  const { status } = useWeb3Status();

  const enabled = Boolean(status && status.enabled);

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>On-chain activity</CardTitle>
          <CardDescription>On-chain claiming is not configured yet in this environment.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const label = (kind: string): string => TRANSACTION_TYPE_LABELS[kind as keyof typeof TRANSACTION_TYPE_LABELS] ?? kind;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>On-chain activity</CardTitle>
            <CardDescription>Claims and settlements verified against the network.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <ShieldCheck className="size-3 text-success" /> chain-verified
            </Badge>
            <Button size="xs" variant="ghost" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Clock className="size-3" />}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {claims.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Claims</p>
              <div className="space-y-2">
                {claims.map((c) => (
                  <div key={c.claimId} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-violet-300/25 bg-violet-500/10 text-violet-300">
                      <ShieldCheck className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">Reward {c.rewardId}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.state} · {c.reservedAt ? new Date(c.reservedAt).toLocaleString() : "Pending confirmation"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.txHash && (
                        <a
                          href={explorerTxUrl(c.txHash) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                        >
                          {shortHash(c.txHash)} <ExternalLink className="size-3" />
                        </a>
                      )}
                      <span className={cn("font-heading text-sm font-semibold",
                        c.state === "confirmed" ? "text-cyan-300" : "text-amber-300")}>
                        {c.amountDecimal !== null && c.amountDecimal !== undefined ? `${c.amountDecimal.toLocaleString()} FIX` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settlements
          </p>
          {transactions.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No on-chain transactions yet.
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
                    {tx.type === "claim" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{label(tx.type)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()} · chain {tx.chainId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.txHash && (
                      <a
                        href={explorerTxUrl(tx.txHash) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                      >
                        {shortHash(tx.txHash)} <ExternalLink className="size-3" />
                      </a>
                    )}
                    {tx.status === "confirmed" && <CheckCircle2 className="size-3.5 text-success" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}