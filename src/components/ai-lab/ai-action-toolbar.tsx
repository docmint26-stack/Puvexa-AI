"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Loader2 } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared/icon";
import { ACTION_META, type AiToolId } from "./ai-data";

export function AiActionToolbar({
  running,
  disabled,
  onRun,
}: {
  running: AiToolId | null;
  disabled: boolean;
  onRun: (id: AiToolId) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <LayoutGrid className="size-3" /> Quick AI actions
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          API connected
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ACTION_META.map((action) => {
          const active = running === action.id;
          const dimmed = running && !active;
          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => onRun(action.id)}
              className={cn(
                "group relative flex flex-col items-start gap-1.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                active
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 bg-muted/10 hover:border-primary/30 hover:bg-muted/20",
                dimmed && "border-border/40 bg-muted/5",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {active && (
                <motion.span
                  layoutId="ai-action-active"
                  className="absolute left-0 top-0 h-full w-0.5 bg-linear-to-b from-violet-400 to-cyan-400"
                />
              )}
              {active && <span className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full bg-primary/10 blur-2xl" />}
              <span
                className={cn(
                  "flex items-center gap-2 text-xs font-semibold",
                  active ? "text-primary" : "text-foreground"
                )}
              >
                {active ? <Loader2 className="size-3.5 animate-spin" /> : <Icon name={action.icon} className="size-3.5" />}
                {action.label}
              </span>
              <span className="text-[10px] leading-snug text-muted-foreground">{action.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MatchedSignaturesChip({ count }: { count: number }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
          <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" />
            {count} signature{count > 1 ? "s" : ""} matched
          </Badge>
        </motion.div>
      )}
    </AnimatePresence>
  );
}