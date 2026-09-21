"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Fingerprint,
  Loader2,
  PlugZap,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TokenBadge } from "@/components/shared/token-badge";
import { shortAddress } from "@/lib/format";
import { chainLabel } from "@/lib/web3/config";
import { useRewards, useWallet } from "@/lib/hooks";
import { useWalletBalance, useWalletVerification, useWeb3Identity } from "@/lib/hooks/web3";
import { useWalletStore } from "@/lib/state/wallet";

export type WalletId = "metaMask" | "okx" | "tokenPocket" | "imToken" | "walletConnect" | "all";

interface WalletMeta {
  id: WalletId;
  name: string;
  monogram: string;
  gradient: string;
  ring: string;
  description: string;
  tip: string;
}

const WALLETS: WalletMeta[] = [
  {
    id: "metaMask",
    name: "MetaMask",
    monogram: "MM",
    gradient: "from-orange-400 to-amber-500",
    ring: "border-orange-400/30",
    description: "The most widely used browser wallet.",
    tip: "Approve the popup in the MetaMask extension — one connection, then one short signature.",
  },
  {
    id: "okx",
    name: "OKX Wallet",
    monogram: "OK",
    gradient: "from-cyan-400 to-blue-600",
    ring: "border-cyan-400/30",
    description: "Browser extension with built-in cross-chain swap.",
    tip: "Open the OKX extension and approve the pairing. A signature verifies ownership on Puvexa.",
  },
  {
    id: "tokenPocket",
    name: "TokenPocket",
    monogram: "TP",
    gradient: "from-blue-500 to-indigo-600",
    ring: "border-blue-400/30",
    description: "Multi-chain wallet for desktop and mobile.",
    tip: "Scan the QR code in the mobile app or approve the browser extension request.",
  },
  {
    id: "imToken",
    name: "imToken",
    monogram: "im",
    gradient: "from-indigo-400 to-violet-600",
    ring: "border-indigo-400/30",
    description: "Self-custodial wallet trusted by millions.",
    tip: "Approve the connection in imToken and confirm the ownership signature.",
  },
  {
    id: "walletConnect",
    name: "WalletConnect",
    monogram: "◈",
    gradient: "from-slate-100 to-blue-500",
    ring: "border-slate-300/30",
    description: "Connect any mobile wallet via QR or deep link.",
    tip: "A QR code opens — scan it with any WalletConnect-ready app to link this session.",
  },
  {
    id: "all",
    name: "All Wallets",
    monogram: "••",
    gradient: "from-violet-500 to-fuchsia-500",
    ring: "border-violet-400/30",
    description: "Browse 500+ supported wallets.",
    tip: "Pick your wallet from the full directory. Puvexa connects through WalletConnect or injected providers.",
  },
];

const badgeClass: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-info/40 bg-info/10 text-info",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

export function WalletConnectButton({ size = "md" }: { size?: "md" | "lg" }) {
  const { state } = useWallet();
  const [open, setOpen] = React.useState(false);

  const content =
    state.status === "verified" || state.status === "connected" ? (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-xs font-medium text-foreground">
        <span className="grid size-5 place-items-center rounded-md bg-success/15 text-success">
          <ShieldCheck className="size-3" />
        </span>
        <span className="font-mono">{state.shortAddress ?? "Connected"}</span>
      </span>
    ) : state.status === "wrong-network" || state.status === "error" ? (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
        <AlertTriangle className="size-3" />
        {state.status === "wrong-network" ? "Wrong network" : "Wallet error"}
      </span>
    ) : state.status === "connecting" || state.status === "verifying" ? (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {state.status === "connecting" ? "Connecting…" : "Verifying…"}
      </span>
    ) : (
      <Button size={size === "lg" ? "lg" : "sm"} variant="outline" className="gap-1.5">
        <Wallet className="size-4" />
        Connect wallet
      </Button>
    );

  return (
    <WalletConnectModal open={open} onOpenChange={setOpen}>
      <button type="button" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setOpen(true)}>
        {content}
      </button>
    </WalletConnectModal>
  );
}

function WalletOptionList({
  selected,
  busy,
  disabled,
  onSelect,
}: {
  selected: WalletId;
  busy: boolean;
  disabled: boolean;
  onSelect: (id: WalletId) => void;
}) {
  return (
    <div className="space-y-1.5">
      {WALLETS.map((w) => {
        const active = selected === w.id;
        const isConnecting = busy && active;
        return (
          <button
            key={w.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(w.id)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
              active
                ? "border-primary/50 bg-primary/5"
                : "border-border/60 bg-muted/10 hover:border-primary/30 hover:bg-muted/20",
              disabled && "opacity-60"
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg border bg-linear-to-br text-[10px] font-black tracking-tight text-white shadow-sm",
                w.gradient,
                w.id === "walletConnect" && "text-[14px] font-bold",
                w.id === "all" && "text-[12px]",
                active ? "border-transparent ring-2 ring-primary/30" : "border-black/20"
              )}
            >
              {w.monogram}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{w.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{w.description}</span>
            </span>
            {w.id === "all" && (
              <span className="shrink-0 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                500+
              </span>
            )}
            {isConnecting ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : active ? (
              <span className="grid size-5 shrink-0 place-items-center rounded-full border border-primary bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function OrbVisual() {
  return (
    <div className="relative mx-auto grid size-44 place-items-center">
      <span className="absolute inset-0 animate-pulse-glow rounded-full bg-linear-to-br from-violet-500/25 via-primary/15 to-cyan-400/25 blur-2xl" />
      <span className="absolute inset-3 animate-spin-slow rounded-full border border-dashed border-primary/30" />
      <span className="absolute inset-3 animate-aurora rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,var(--color-primary)_0%,transparent_100%)] opacity-60" />
      <span className="absolute inset-8 animate-signal rounded-full border border-cyan-300/50" />
      <span className="absolute inset-12 rounded-full border border-blue-300/25" />
      <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-primary/50 bg-card/80 text-primary shadow-2xl shadow-primary/25 backdrop-blur-xl">
        <Wallet className="size-7" />
      </span>
      <span className="absolute left-4 top-8 size-2 animate-float rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
      <span className="absolute bottom-6 right-6 size-1.5 animate-float-slow rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.8)]" />
    </div>
  );
}

function VerifyOrbVisual() {
  return (
    <div className="relative mx-auto grid size-32 place-items-center">
      <span className="absolute inset-0 animate-pulse-glow rounded-full bg-success/15 blur-2xl" />
      <span className="absolute inset-2 animate-signal rounded-full border border-success/50" />
      <span className="grid size-16 place-items-center rounded-2xl border border-success/50 bg-success/10 text-success">
        <Fingerprint className="size-7" />
      </span>
    </div>
  );
}

function WrongNetworkVisual() {
  return (
    <div className="relative mx-auto grid size-28 place-items-center">
      <span className="absolute inset-0 animate-pulse-glow rounded-full bg-warning/15 blur-2xl" />
      <span className="grid size-16 place-items-center rounded-2xl border border-warning/50 bg-warning/10 text-warning">
        <PlugZap className="size-7" />
      </span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Copy address"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function WalletStatusCard({
  state,
  onVerify,
  onSwitchNetwork,
  onDisconnect,
  busy,
}: {
  state: ReturnType<typeof useWallet>["state"];
  onVerify: () => void;
  onSwitchNetwork: () => void;
  onDisconnect: () => void;
  busy: boolean;
}) {
  const router = useRouter();
  const { config } = useWeb3Identity();
  const { balance, claimable } = useRewards();
  const { balanceDecimal } = useWalletBalance(
    (state.address as `0x${string}`) ?? null,
    (config.tokenAddress as `0x${string}`) ?? null,
  );

  const verified = state.status === "verified";
  const wrongNetwork = state.status === "wrong-network";
  const demo = config.mode === "demo";
  const bal = demo ? balance : (balanceDecimal ?? null);
  const networkLabel = wrongNetwork
    ? `Chain ${state.chainId ?? "?"}`
    : demo
      ? state.network || "FIX Demo · Testnet"
      : chainLabel(state.chainId ?? config.chainId);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-2xl border p-4",
          verified
            ? "border-success/30 bg-success/5"
            : wrongNetwork
              ? "border-warning/30 bg-warning/5"
              : "border-border/70 bg-muted/20"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl border",
                verified
                  ? "border-success/40 bg-success/10 text-success"
                  : wrongNetwork
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-foreground/15 text-muted-foreground"
              )}
            >
              {verified ? <ShieldCheck className="size-5" /> : wrongNetwork ? <AlertTriangle className="size-5" /> : <Wallet className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {verified ? "Verified" : wrongNetwork ? "Wrong network" : "Connected"}
                {verified && <BadgeCheck className="size-3.5 text-success" />}
              </p>
              <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <span className="truncate">{state.address ? shortAddress(state.address) : "—"}</span>
                {state.address && <CopyButton value={state.address} />}
              </p>
            </div>
          </div>
          <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold", badgeClass[wrongNetwork ? "warning" : verified ? "success" : "info"])}>
            {networkLabel}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <InfoCell label="FIX balance" value={bal === null ? "—" : `${bal.toFixed(2)} FIX`} strong />
          <InfoCell label="Claimable rewards" value={demo ? `${claimable.toLocaleString()} FIX` : `${claimable.toLocaleString()} FIX`} />
          <InfoCell label="Wallet status" value={verified ? "Ownership verified" : wrongNetwork ? "Network not set" : "Connected"} />
          <InfoCell label="Network" value={networkLabel} />
        </div>
      </div>

      {wrongNetwork && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          Puvexa runs on {demo ? "the demo network" : `${chainLabel(config.chainId)} (chain ${config.chainId})`}. Switch networks to continue.
        </p>
      )}

      <div className="grid gap-2">
        {wrongNetwork && (
          <Button className="w-full" size="lg" onClick={onSwitchNetwork} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Switch Network
          </Button>
        )}
        {!verified && !wrongNetwork && (
          <Button className="w-full" size="lg" onClick={onVerify} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Verify ownership
          </Button>
        )}
        {verified && (
          <Button className="w-full" size="lg" onClick={() => router.push("/rewards")}>
            <TokenBadge value={claimable} /> Claim FIX <ArrowRight className="size-4" />
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => router.push("/rewards")}>
            <ExternalLink className="size-3.5" /> View transactions
          </Button>
          <Button variant="ghost" onClick={onDisconnect} disabled={busy}>
            <X className="size-3.5" /> Disconnect
          </Button>
        </div>
      </div>

      {verified && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-primary" /> Signature verified — this signature cost no gas.
        </p>
      )}
    </div>
  );
}

function InfoCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate text-xs font-semibold text-foreground", strong && "text-cyan-300")}>{value}</p>
    </div>
  );
}

export function WalletInfoPanel({
  selected,
  busy,
  verifying,
}: {
  selected: WalletId;
  busy: boolean;
  verifying: boolean;
}) {
  const [helpOpen, setHelpOpen] = React.useState(false);
  const wallet = WALLETS.find((w) => w.id === selected) ?? WALLETS[0];

  return (
    <div className="relative flex h-full min-h-96 flex-col overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-violet-500/[0.07] via-card/40 to-cyan-400/[0.07] p-5">
      <div className="pointer-events-none absolute -top-10 right-0 size-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 size-32 rounded-full bg-cyan-400/10 blur-3xl" />

      <AnimatePresence mode="wait">
        {verifying ? (
          <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <VerifyOrbVisual />
            <p className="font-heading text-sm font-semibold text-foreground">Verifying wallet ownership</p>
            <p className="max-w-[220px] text-[11px] text-muted-foreground">
              Confirming the signature with the Puvexa identity graph.
            </p>
            <ol className="mt-2 space-y-1.5 text-left text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5"><Check className="size-3 text-success" /> Wallet connected</li>
              <li className="flex items-center gap-1.5"><Check className="size-3 text-success" /> Signature signed</li>
              <li className="flex items-center gap-1.5"><Loader2 className="size-3 animate-spin text-primary" /> Ownership confirmed</li>
            </ol>
          </motion.div>
        ) : (
          <motion.div key={wallet.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="relative flex flex-1 flex-col items-center text-center">
            <OrbVisual />
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">Connect your wallet to continue</h3>
            <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
              Securely connect a wallet to claim rewards, stake FIXAI, and access Web3 features.
            </p>

            <div className="mt-4 w-full rounded-xl border border-border/60 bg-card/50 p-3 text-left">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <ScanLine className="size-3" /> {wallet.name}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {wallet.tip}
                {busy && <span className="mt-1 block text-primary">Waiting for approval…</span>}
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHelpOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                <CircleHelp className="size-3" /> New to wallets?
              </button>
            </div>
            <AnimatePresence>
              {helpOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 w-full overflow-hidden"
                >
                  <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    A wallet is a self-custodied key for signing — Puvexa never sees your private key or seed phrase. Wallets are free; the ownership check is a signature, so it costs no gas.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WalletConnectModal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      {children}
      <AnimatePresence>
        {open && <ModalFrame key="wallet-modal" onClose={() => onOpenChange(false)} />}
      </AnimatePresence>
    </>
  );
}

function ModalFrame({ onClose }: { onClose: () => void }) {
  const { state, disconnect } = useWallet();
  const { connectAndVerify, switchToAppChain, verify } = useWalletVerification();
  const { config } = useWeb3Identity();
  const [pickOverride, setPickOverride] = React.useState(false);
  const [selected, setSelected] = React.useState<WalletId>("metaMask");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = state.status;
  const connected = status === "connected" || status === "verified";
  const wrongNetwork = status === "wrong-network";
  const verifying = status === "connecting" || status === "verifying";
  const showSummary = !pickOverride && (connected || wrongNetwork);

  const onConnect = async (id: WalletId) => {
    setSelected(id);
    setError(null);
    setBusy(true);
    setPickOverride(false);
    if (config.mode === "demo") {
      setNotice("Opening the wallet… approve the connection to continue.");
      const finalStatus = await useWalletStore.getState().connect("MetaMask");
      setNotice(null);
      setBusy(false);
      if (finalStatus !== "verified") setNotice("Demo connection finished without reaching verified status.");
      return;
    }
    if (id !== "metaMask" && id !== "walletConnect" && id !== "all") {
      setNotice("This build connects via the injected MetaMask provider — it will be used instead.");
    } else {
      setNotice("Confirm the connection and signature in your wallet.");
    }
    const result = await connectAndVerify();
    setNotice(null);
    setBusy(false);
    if (result && !result.ok) {
      setError(result.error);
    }
  };

  const onVerify = async () => {
    setBusy(true);
    setError(null);
    setNotice("Sign the ownership challenge — this signature costs no gas.");
    const s = useWalletStore.getState();
    const outcome = await verify(s.address ?? "", s.chainId ?? config.chainId);
    if (outcome.ok) {
      useWalletStore.getState().markVerified();
      setNotice(null);
    } else {
      setError(outcome.error);
      setNotice(null);
    }
    setBusy(false);
  };

  const onSwitchNetwork = async () => {
    setBusy(true);
    setError(null);
    if (config.mode === "demo") {
      await useWalletStore.getState().connect("MetaMask");
      useWalletStore.getState().markVerified();
      setBusy(false);
      return;
    }
    const result = await switchToAppChain();
    setBusy(false);
    if (result.ok) {
      const s = useWalletStore.getState();
      if (s.status === "connected") {
        const outcome = await verify(s.address ?? "", s.chainId ?? config.chainId);
        if (outcome.ok) {
          useWalletStore.getState().markVerified();
        } else {
          setError(outcome.error);
        }
      }
    } else {
      setError(result.error);
    }
  };

  const onDisconnect = () => {
    disconnect();
    setNotice(null);
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-2xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Connect wallet"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/[0.06] to-transparent" />

              <div className="relative flex items-center justify-between px-5 pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 border-primary/25 bg-primary/5 px-2 py-0.5 text-[9px] uppercase tracking-widest text-primary">
                    <Sparkles className="size-2.5" /> Web3 access
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="relative grid gap-0 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:gap-4">
                <div className="min-w-0 space-y-3">
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-foreground">Connect Wallet</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {showSummary ? "Your connected wallet is ready." : "Choose how you want to connect."}
                    </p>
                  </div>

                  {showSummary ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/15 p-3">
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border bg-linear-to-br text-[10px] font-black text-white", (WALLETS.find((w) => w.id === selected) ?? WALLETS[0]).gradient)}>
                          {(WALLETS.find((w) => w.id === selected) ?? WALLETS[0]).monogram}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{(WALLETS.find((w) => w.id === selected) ?? WALLETS[0]).name}</p>
                          <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <span className="truncate">{state.address ? shortAddress(state.address) : "—"}</span>
                            {status === "verified" && <BadgeCheck className="size-3 text-success" />}
                          </p>
                        </div>
                      </div>

                      {notice && <Notice tone="info" text={notice} />}
                      {error && <Notice tone="danger" text={error} />}

                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => setPickOverride(true)}
                          className="flex w-full items-center justify-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Switch wallet <RefreshCw className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={onDisconnect}
                          className="flex w-full items-center justify-center gap-1 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-3" /> Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <WalletOptionList selected={selected} busy={busy} disabled={busy} onSelect={(id) => void onConnect(id)} />
                  )}
                </div>

                <div className="mt-4 min-w-0 sm:mt-0">
                  {showSummary ? (
                    <div className="space-y-3">
                      {notice && <Notice tone="info" text={notice} />}
                      {error && <Notice tone="danger" text={error} />}
                      <WalletStatusCard
                        state={state}
                        onVerify={() => void onVerify()}
                        onSwitchNetwork={() => void onSwitchNetwork()}
                        onDisconnect={onDisconnect}
                        busy={busy}
                      />
                    </div>
                  ) : wrongNetwork ? (
                    <div className="flex h-full min-h-96 flex-col items-center justify-center rounded-2xl border border-warning/30 bg-warning/5 p-5 text-center">
                      <WrongNetworkVisual />
                      <h3 className="mt-4 font-heading text-sm font-semibold text-foreground">Wrong network detected</h3>
                      <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                        Switch to {config.mode === "demo" ? "the demo network" : `${chainLabel(config.chainId)} (chain ${config.chainId})`} to connect.
                      </p>
                      <Button className="mt-4 w-full" size="lg" onClick={() => void onSwitchNetwork()} disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Switch Network
                      </Button>
                      {notice && <Notice tone="info" text={notice} className="mt-3 w-full text-left" />}
                      {error && <Notice tone="danger" text={error} className="mt-3 w-full text-left" />}
                    </div>
                  ) : (
                    <WalletInfoPanel selected={selected} busy={busy} verifying={verifying} />
                  )}
                </div>
              </div>

              <div className="relative flex items-center justify-between border-t border-border/50 px-5 py-3">
                <p className="text-[10px] text-muted-foreground">
                  {config.mode === "demo" ? "Demo mode — connection is simulated locally." : "Puvexa never asks for your seed phrase or private key."}
                </p>
                <button type="button" onClick={onClose} className="text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
  );
}

function Notice({ text, tone, className }: { text: string; tone: "info" | "danger"; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
        tone === "info" ? "border-cyan-400/25 bg-cyan-400/5 text-cyan-300" : "border-destructive/30 bg-destructive/10 text-destructive",
        className
      )}
    >
      {tone === "info" ? <InfoGlyph /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
      {text}
    </p>
  );
}

function InfoGlyph() {
  return <Sparkles className="mt-0.5 size-3.5 shrink-0 text-cyan-300" />;
}