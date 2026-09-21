"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  ClipboardList,
  Copy,
  Crosshair,
  FileCheck2,
  Fingerprint,
  Layers,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { usedByLabel, type AiOutput, type AiToolId } from "./ai-data";

const STAGE_KEYS = [
  { key: "ingest", icon: Layers, label: "Ingesting inputs" },
  { key: "signature", icon: Fingerprint, label: "Extracting signatures" },
  { key: "match", icon: ScanSearch, label: "Matching fix graph" },
  { key: "rank", icon: ClipboardList, label: "Ranking fixes" },
] as const;

function ConfidenceRing({ value }: { value: number }) {
  return (
    <div className="relative grid size-16 place-items-center">
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--color-primary) ${value * 3.6}deg, color-mix(in srgb, var(--color-border) 55%, transparent) 0deg)`,
        }}
      />
      <span className="absolute inset-1.5 rounded-full bg-card" />
      <span className="relative text-xs font-bold tabular-nums text-foreground">{value}%</span>
    </div>
  );
}

export function AiOutputPanel({
  output,
  running,
  runningTool,
}: {
  output: AiOutput | null;
  running: boolean;
  runningTool: AiToolId | null;
}) {
  const [copied, setCopied] = React.useState(false);
  const [stageCount, setStageCount] = React.useState(0);

  React.useEffect(() => {
    if (!running) return;
    let i = 0;
    const reset = window.setTimeout(() => {
      setStageCount(0);
      const iv = window.setInterval(() => {
        i += 1;
        setStageCount(Math.min(i, STAGE_KEYS.length));
        if (i >= STAGE_KEYS.length) window.clearInterval(iv);
      }, 350);
    }, 30);
    return () => {
      window.clearTimeout(reset);
    };
  }, [running]);

  if (!running && !output) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-primary/25 bg-primary/5 text-primary">
          <ScanSearch className="size-6" />
        </span>
        <div>
          <p className="font-heading text-sm font-semibold text-foreground">AI output appears here</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Pick a quick action, or add <span className="font-mono text-cyan-300">wlan_power_issue_log.txt</span> and run{" "}
            <span className="font-medium text-foreground">Analyze Logs</span>.
          </p>
        </div>
      </div>
    );
  }

  if (running) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="size-2 animate-ping rounded-full bg-primary" />
          {usedByLabel(runningTool ?? "analyze-problem")}…
        </p>
        <div className="mt-5 space-y-2.5">
          {STAGE_KEYS.map((s, i) => {
            const on = i < stageCount;
            return <BeaconStage key={s.key} icon={s.icon} label={s.label} on={on} />;
          })}
        </div>
      </div>
    );
  }

  if (!output) {
    return null;
  }

  const copyText = [output.issue, output.rootCause, ...output.fixes.map((f) => `${f.rank}. ${f.title}`)].join("\n");

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-primary/25 bg-primary/5 p-1.5 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">{usedByLabel(output.tool)}</p>
            <p className="text-[10px] text-muted-foreground">Puvexa AI · {output.generatedAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Demo
          </Badge>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(copyText).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              });
            }}
            className="grid size-7 place-items-center rounded-md border border-border/60 bg-muted/20 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Copy output"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-3">
            <OutputSection icon={Crosshair} tint="text-violet-300" title="Issue">
              <p className="text-sm text-foreground">{output.issue}</p>
            </OutputSection>
            <OutputSection icon={ShieldAlert} tint="text-amber-300" title="Likely root cause">
              <p className="text-sm leading-relaxed text-muted-foreground">{output.rootCause}</p>
            </OutputSection>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:w-40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
            <ConfidenceRing value={output.confidence} />
            <p className="text-[10px] leading-snug text-muted-foreground">
              {output.confidence >= 80 ? "High — matches verified fix graphs." : output.confidence >= 65 ? "Medium — overlapping signatures." : "Low — limited matched evidence."}
            </p>
          </div>
        </div>

        <OutputSection icon={ClipboardList} tint="text-cyan-300" title={`Suggested fixes (${output.fixes.length})`}>
          <div className="space-y-1.5">
            {output.fixes.map((fix) => (
              <div key={fix.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold tabular-nums",
                    fix.tone === "primary" ? "bg-linear-to-br from-violet-500/25 to-cyan-500/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  #{fix.rank}
                </span>
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{fix.title}</p>
                <span className="shrink-0 text-[10px] font-semibold text-success">{fix.successRate}%</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fix.minutes}</span>
              </div>
            ))}
          </div>
        </OutputSection>

        <div className="grid gap-3 sm:grid-cols-2">
          <OutputSection icon={Layers} tint="text-success" title="Similar verified cases">
            <div className="space-y-1.5">
              {output.similar.map((s) => (
                <div key={s.title} className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                  <p className="truncate text-xs font-medium text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    <span className="text-success">{s.matched}</span>
                    <span className="mx-1 opacity-50">·</span>confidence {s.confidence}%
                  </p>
                </div>
              ))}
            </div>
          </OutputSection>

          <OutputSection icon={Fingerprint} tint="text-primary" title="Matched signatures">
            <div className="flex flex-wrap gap-1.5">
              {output.signals.map((sig) => (
                <span key={sig} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 font-mono text-[10px] text-cyan-300">
                  {sig}
                </span>
              ))}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-success" />
              {output.note}
            </p>
          </OutputSection>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 pt-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <FileCheck2 className="size-3 text-success" />
            Provenance: <span className="font-mono text-foreground/80">{output.provenance.join(", ")}</span>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <BadgeCheck className="size-3 text-cyan-300" />
            Signature-based diagnosis · costs no gas
          </span>
        </div>
      </div>
    </div>
  );
}

function BeaconStage({ icon: IconComp, label, on }: { icon: typeof Layers; label: string; on: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3"
    >
      <span
        className={cn(
          "relative grid size-7 place-items-center rounded-lg border transition-colors",
          on ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-muted/20 text-muted-foreground"
        )}
      >
        <IconComp className="size-3.5" />
        {on && (
          <span className="absolute right-0 top-0 grid size-2.5 place-items-center rounded-full bg-primary">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          </span>
        )}
      </span>
      <p className={cn("text-xs", on ? "text-foreground" : "text-muted-foreground")}>{label}</p>
      <span className="ml-auto text-[10px] text-muted-foreground">
        {on ? "done" : "pending"}
      </span>
    </motion.div>
  );
}

function OutputSection({
  icon: IconComp,
  tint,
  title,
  children,
}: {
  icon: typeof Layers;
  tint: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <IconComp className={cn("size-3.5", tint)} />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}