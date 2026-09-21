"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared/icon";
import { AI_TABS, buildTextOutput, type AiCreationTabId, type AiFile, type AiTextOutput } from "./ai-data";

export function AiCreationLabTabs({ files }: { files: AiFile[] }) {
  const [tab, setTab] = React.useState<AiCreationTabId>("diagnose");
  const [value, setValue] = React.useState("");
  const [running, setRunning] = React.useState<AiCreationTabId | null>(null);
  const [output, setOutput] = React.useState<AiTextOutput | null>(null);

  const meta = AI_TABS.find((t) => t.id === tab) ?? AI_TABS[0];

  const onGenerate = () => {
    if (running) return;
    setRunning(tab);
    setOutput(null);
    setTimeout(() => {
      setOutput(buildTextOutput(tab, value, files.filter((f) => f.status === "ready")));
      setRunning(null);
    }, 1500);
  };

  return (
    <section className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg border border-primary/25 bg-primary/5 text-primary">
            <WandSparkles className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">Create with AI</h2>
            <p className="text-[11px] text-muted-foreground">AI Creation Lab — generate reports, plans, and clean summaries.</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Lab
        </Badge>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {AI_TABS.map((t) => {
          const activeT = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setOutput(null);
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                activeT
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <Icon name={t.icon} className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="mt-3 flex items-start gap-3 rounded-xl border border-border/50 bg-muted/10 p-3"
        >
          <Icon name={meta.icon} className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">{meta.prompt}</p>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={meta.placeholder}
              className="mt-2 min-h-20 bg-card/50"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                {files.length > 0 ? `${files.length} file(s) attached for provenance` : "Optional: attach files from the workspace above."}
              </p>
              <Button size="sm" onClick={onGenerate} disabled={!!running}>
                {running === tab ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Generate
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {running === tab && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Composing {meta.label}…
        </div>
      )}

      {output && running !== tab && <TextResultCard output={output} />}
    </section>
  );
}

export function TextResultCard({ output }: { output: AiTextOutput }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/50"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-success/30 bg-success/10 p-1 text-success">
            <Sparkles className="size-3" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">{output.title}</p>
            <p className="text-[10px] text-muted-foreground">{output.label}</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 px-2 py-0.5 text-[9px] text-success">
          <span className="size-1.5 rounded-full bg-success" /> Verified demo
        </Badge>
      </div>
      <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-[13px] leading-relaxed text-muted-foreground">{output.body}</pre>
      <p className="border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
        Provenance: <span className="font-mono">{output.provenance.join(", ")}</span>
      </p>
    </motion.div>
  );
}