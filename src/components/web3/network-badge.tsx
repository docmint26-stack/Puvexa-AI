"use client";

import { cn } from "cn";
import { useWeb3Identity } from "@/lib/hooks/web3";

export function NetworkBadge({ className }: { className?: string }) {
  const { identity } = useWeb3Identity();
  const tones = {
    local: "border-amber-300/25 bg-amber-400/10 text-amber-300",
    testnet: "border-cyan-300/25 bg-cyan-400/10 text-cyan-300",
    demo: "border-violet-300/25 bg-violet-500/10 text-violet-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
        tones[identity.tone],
        className,
      )}
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {identity.label}
    </span>
  );
}