"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Plus, MessageSquareText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "./file-upload-zone";
import { AiActionToolbar, MatchedSignaturesChip } from "./ai-action-toolbar";
import { AiOutputPanel } from "./ai-output-panel";
import { AiCreationLabTabs } from "./ai-creation-lab";
import {
  buildOutput,
  DEMO_FILES,
  ENVIRONMENTS,
  CATEGORIES,
  uidFile,
  type AiFile,
  type AiOutput,
  type AiRunInput,
  type AiToolId,
} from "./ai-data";

const DEMO_QUICK = DEMO_FILES.slice(0, 4);

export function AiTestWorkspace() {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [environment, setEnvironment] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [files, setFiles] = React.useState<AiFile[]>([]);
  const [running, setRunning] = React.useState<AiToolId | null>(null);
  const [output, setOutput] = React.useState<AiOutput | null>(null);

  const readyFiles = files.filter((f) => f.status === "ready");
  const matchedSignatures = readyFiles.some((f) => f.kind === "log") ? 3 : readyFiles.some((f) => f.kind === "image") ? 2 : readyFiles.length > 0 ? 1 : 0;

  const addFiles = (next: AiFile[]) => {
    setFiles((prev) => [...prev, ...next]);
    for (const file of next) {
      const speed = 18 + Math.floor(Math.random() * 8);
      const ticks = Math.ceil(100 / speed);
      let count = 0;
      const iv = window.setInterval(() => {
        count += 1;
        const progress = Math.min(100, count * speed);
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, progress, status: progress >= 100 ? "ready" : "uploading" } : f)),
        );
        if (count >= ticks) window.clearInterval(iv);
      }, 160);
      timersRef.current.push(iv);
    }
  };

  const timersRef = React.useRef<number[]>([]);
  React.useEffect(() => () => timersRef.current.forEach((t) => window.clearInterval(t)), []);

  const run = (tool: AiToolId) => {
    if (running) return;
    setRunning(tool);
    setOutput(null);
    const input: AiRunInput = { title, description, category, environment, tags, files: readyFiles };
    window.setTimeout(() => {
      setOutput(buildOutput(tool, input));
      setRunning(null);
    }, 1800);
  };

  const clearAll = () => {
    setFiles([]);
    setOutput(null);
    setRunning(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" /> Puvexa AI
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">AI Test Workspace</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Try Puvexa&apos;s diagnostics without a full case — paste symptoms, attach evidence, and run a quick action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MatchedSignaturesChip count={matchedSignatures} />
          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Demo
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquareText className="size-3" /> Describe the problem
              </p>
              {files.length > 0 && (
                <Button size="xs" variant="ghost" onClick={clearAll} className="text-muted-foreground">
                  Clear
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title — e.g. Wi-Fi keeps disconnecting"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happens — when it started, frequency, what you already tried…"
                className="min-h-24"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={environment} onValueChange={(v) => setEnvironment(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Environment (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags, comma-separated — e.g. wlan, battery, windows-11"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Plus className="size-3" /> Evidence files
              </p>
            </div>

            <FileUploadZone files={files} onAdd={addFiles} disabled={!!running} />

            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Try a sample</p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_QUICK.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    disabled={!!running || files.some((x) => x.name === f.name)}
                    onClick={() =>
                      addFiles([
                        {
                          id: uidFile(),
                          name: f.name,
                          size: f.size,
                          kind: f.kind,
                          progress: 0,
                          status: "uploading",
                        },
                      ])
                    }
                    className="rounded-lg border border-border/60 bg-muted/15 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
                  >
                    {f.name.split(".")[0].slice(0, 18)}.{f.name.split(".")[1]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <AiActionToolbar running={running} disabled={!readyFiles.length} onRun={run} />
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Output</p>
          <AiOutputPanel output={output} running={!!running} runningTool={running} />
        </div>
      </div>

      <AiCreationLabTabs files={files} />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-[11px] text-muted-foreground"
      >
        AI runs in demo mode locally — outputs are simulated for preview. Live analysis connects to the Puvexa diagnosis API.
      </motion.p>
    </div>
  );
}