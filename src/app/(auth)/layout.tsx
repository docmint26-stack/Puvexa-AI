import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import Link from "next/link";
import { chainLabel, networkIdentity, web3Config } from "@/lib/web3/config";

const identity = networkIdentity();
const badgeText =
  identity.mode === "demo"
    ? "FIX Demo Environment"
    : identity.mode === "local"
      ? `FIX Local · ${chainLabel(web3Config.chainId)}`
      : web3Config.chainId
        ? `FIX Testnet · ${chainLabel(web3Config.chainId)}`
        : "FIX Testnet";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-grid-faint opacity-60" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-linear-to-b from-primary/10 to-transparent" />
      <div className="pointer-events-none fixed bottom-0 left-1/4 size-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none fixed -right-24 top-1/4 size-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative w-full max-w-5xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {badgeText}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}