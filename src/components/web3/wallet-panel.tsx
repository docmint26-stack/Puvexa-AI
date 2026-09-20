"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";
import { useWallet } from "@/lib/hooks";
import { useWalletVerification, useWeb3Identity, useWalletBalance } from "@/lib/hooks/web3";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { shortAddress } from "@/lib/format";
import { getConnectedAccount, reconnectWallets } from "@/lib/web3/actions";
import { useWalletStore } from "@/lib/state/wallet";

export function WalletButtonTrigger({ size = "md" }: { size?: "md" | "lg" }) {
  const { state } = useWallet();

  if (state.status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-xs font-medium text-foreground">
        <span className="grid size-5 place-items-center rounded-md bg-success/15 text-success">
          <ShieldCheck className="size-3" />
        </span>
        <span className="font-mono">{state.shortAddress}</span>
      </span>
    );
  }
  if (state.status === "wrong-network" || state.status === "error") {
    return (
      <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
        <AlertTriangle className="size-3" />
        {state.status === "wrong-network" ? "Wrong network" : "Wallet error"}
      </Badge>
    );
  }
  if (state.status === "connecting" || state.status === "verifying") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {state.status === "connecting" ? "Connecting…" : "Verifying…"}
      </span>
    );
  }
  return (
    <Button size={size === "lg" ? "lg" : "sm"} variant="outline" className="gap-1.5">
      <Wallet className="size-4" />
      Connect wallet
      <ChevronDown className="size-3 text-muted-foreground" />
    </Button>
  );
}

export function WalletPanel({ size = "md" }: { size?: "md" | "lg" }) {
  const { state, connect, disconnect } = useWallet();
  const { connectAndVerify, verify, switchToAppChain } = useWalletVerification();
  const { config } = useWeb3Identity();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const { balanceDecimal } = useWalletBalance(
    (state.address as `0x${string}`) ?? null,
    (config.tokenAddress as `0x${string}`) ?? null,
  );

  React.useEffect(() => {
    if (config.mode === "demo") return;
    void reconnectWallets().then(async () => {
      const account = (await getConnectedAccount()) as { address: `0x${string}`; chainId: number } | null;
      if (!account) return;
      const s = useWalletStore.getState();
      if (config.chainId && account.chainId !== config.chainId) {
        s.setWrongNetwork(config.chainId, account.chainId);
      } else if (!s.verifiedAt) {
        s.setConnected(account.address, account.chainId, config.network);
      }
    });
  }, [config]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setActionError(null);
    if (config.mode === "demo") return;
    const s = useWalletStore.getState();
    if (!s.address) return;
    if (s.chainId && config.chainId && s.chainId !== config.chainId) {
      s.setWrongNetwork(config.chainId, s.chainId);
    } else if (s.status === "error") {
      s.resolveError();
    }
  };

  const onConnect = async () => {
    setBusy(true);
    setActionError(null);
    if (config.mode === "demo") {
      setNotice("Simulated connection. Demo only.");
      const status = await connect("MetaMask");
      if (status === "verified") setNotice(null);
      else setNotice("Demo connection finished.");
      setBusy(false);
      return;
    }
    setNotice("Confirm the connection and signature in your wallet.");
    const result = await connectAndVerify();
    if (result && !result.ok) {
      setActionError(result.error);
    }
    setNotice(null);
    setBusy(false);
  };

  const onVerify = async () => {
    setBusy(true);
    setActionError(null);
    setNotice("Sign the ownership challenge in your wallet.");
    const s = useWalletStore.getState();
    const outcome = await verify(s.address ?? "", s.chainId ?? config.chainId);
    if (outcome.ok) {
      s.markVerified();
      setNotice(null);
    } else {
      setActionError(outcome.error);
      setNotice(null);
    }
    setBusy(false);
  };

  const onDisconnect = () => {
    disconnect();
    setOpen(false);
    setNotice(null);
    setActionError(null);
  };

  const demo = config.mode === "demo";
  const verified = state.status === "verified";
  const connected = state.status === "connected" || verified;
  const wrongNetwork = state.status === "wrong-network";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<button type="button" className="focus-visible:outline-none" aria-label="Manage wallet" />}>
        <WalletButtonTrigger size={size} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet &amp; ownership</DialogTitle>
          <DialogDescription>
            Prove you own this wallet before claiming or staking on-chain. Puvexa will never ask for your seed phrase or
            private key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              verified
                ? "border-success/30 bg-success/10"
                : wrongNetwork
                  ? "border-warning/30 bg-warning/10"
                  : "border-border bg-muted/30"
            }`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-lg border ${
                verified
                  ? "border-success/40 text-success"
                  : wrongNetwork
                    ? "border-warning/40 text-warning"
                    : "border-foreground/15 text-muted-foreground"
              }`}
            >
              {verified ? <ShieldCheck className="size-5" /> : wrongNetwork ? <AlertTriangle className="size-5" /> : <Wallet className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {verified ? "Verified" : wrongNetwork ? "Wrong network" : connected ? "Connected" : "Not connected"}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {state.address ? shortAddress(state.address) : "0x0000…0000"}
                {state.address && <span className="ml-2 font-sans text-[10px]">chain {state.chainId ?? config.chainId}</span>}
              </p>
            </div>
            {connected && balanceDecimal !== null && (
              <span className="font-heading text-sm font-semibold text-cyan-300">{balanceDecimal.toFixed(2)} FIX</span>
            )}
          </div>

          {actionError && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <X className="mt-0.5 size-3.5 shrink-0" />
              {actionError}
            </p>
          )}
          {notice && (
            <p className="flex items-start gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-2.5 text-xs text-cyan-300">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              {notice}
            </p>
          )}

          {!connected && !wrongNetwork && (
            <Button className="w-full" size="lg" onClick={onConnect} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
              {demo ? "Connect (simulated)" : "Connect with MetaMask"}
            </Button>
          )}
          {connected && !verified && (
            <Button className="w-full" size="lg" onClick={onVerify} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Verify wallet ownership
            </Button>
          )}
          {wrongNetwork && (
            <Button className="w-full" size="lg" onClick={() => void switchToAppChain()} disabled={busy}>
              <RefreshCw className="size-4" />
              Switch to {demo ? "demo network" : `${config.network} (chain ${config.chainId})`}
            </Button>
          )}
          {verified && (
            <Button className="w-full" size="lg" variant="secondary" onClick={onDisconnect} disabled={busy}>
              <X className="size-4" />
              Disconnect wallet
            </Button>
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}