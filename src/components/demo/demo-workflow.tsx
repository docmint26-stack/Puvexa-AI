"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Coins,
  FileCode,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareQuote,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
  Trophy,
  UserPlus2,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/shared/icon";
import { VerificationPanel } from "@/components/diagnose/verification-panel";
import { useGuestStore } from "@/lib/state/guest";
import { notify } from "@/lib/feedback";

const STAGES = [
  "Problem",
  "Evidence",
  "AI Analysis",
  "Match",
  "Fix",
  "Verify",
  "Learn",
  "Reward",
] as const;
type Stage = (typeof STAGES)[number];

const DURATIONS: Record<Stage, number> = {
  Problem: 2800,
  Evidence: 3200,
  "AI Analysis": 4400,
  Match: 2300,
  Fix: 4600,
  Verify: 4200,
  Learn: 3000,
  Reward: 999999,
};

const CASE_TITLE = "React hydration mismatch caused by client-only timestamp";
const CASE_BODY =
  "A Next.js dashboard header renders a live clock. The server HTML contains one time, the client renders another — React logs a hydration mismatch and the time visibly changes after load.";

const EVIDENCE = [
  { id: "e1", name: "hydration-snapshot.log", kind: "log", size: "4.2 KB", note: "Hydration mismatch error log" },
  { id: "e2", name: "console-error.png", kind: "image", size: "212 KB", note: "Browser console screenshot" },
  { id: "e3", name: "header.tsx", kind: "code", size: "1.8 KB", note: "Component rendering the clock" },
  { id: "e4", name: "ssr-output.txt", kind: "text", size: "620 B", note: "Server render output" },
] as const;

const FIX = {
  title: "Render timestamps client-side only",
  why: "Dates from the client clock never match server HTML. Mount the value inside useEffect so SSR renders a stable placeholder and the client fills it in after mount.",
  steps: [
    "Extract the clock into a client component",
    "Render a stable placeholder during SSR",
    "Set the real time inside useEffect after mount",
  ],
  successRate: 91,
  matchScore: 93,
  confidence: "High" as const,
  risk: "Low" as const,
  effort: "Low" as const,
  time: "5 minutes",
};

const LEARNING = [
  { icon: "shield-check", text: "No chain-of-thought is stored — only high-level reasoning stages" },
  { icon: "lock", text: "Evidence stays in your browser until you choose to submit it" },
  { icon: "share-2", text: "Your verified outcome updates the knowledge graph for future cases" },
];

const START_NOTES = [
  "White-box reasoning: high-level stages, no hidden chain-of-thought",
  "Evidence is sample data — nothing leaves your browser",
  "Works in under a minute; pause anytime with Space",
];

function StageCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("rounded-2xl border border-border/80 bg-card/70 p-5", className)}
    >
      {children}
    </motion.div>
  );
}

function ProblemView() {
  return (
    <div className="space-y-4">
      <StageCard>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          A developer describes the issue
        </p>
        <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">{CASE_TITLE}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{CASE_BODY}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Windows 11", "Development PC", "Next.js 15", "Added live clock"].map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </StageCard>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        Timestamp just now · evidence type selected: code, output
      </div>
    </div>
  );
}

function EvidenceView() {
  const kindMeta: Record<typeof EVIDENCE[number]["kind"], { label: string; icon: typeof FileText }> = {
    log: { label: "Log", icon: FileText },
    image: { label: "Screenshot", icon: ImageIcon },
    code: { label: "Code", icon: FileCode },
    text: { label: "Output", icon: FileText },
  };
  return (
    <div className="space-y-4">
      <StageCard>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence attached & analyzed
          </p>
          <Badge variant="secondary" className="text-[9px]">Sample Data</Badge>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {EVIDENCE.map((e) => {
            const meta = kindMeta[e.kind];
            const FileIcon = meta.icon;
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/30"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg border",
                    e.kind === "code"
                      ? "border-violet-300/25 bg-violet-500/10 text-violet-300"
                      : e.kind === "image"
                        ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
                        : e.kind === "log"
                          ? "border-amber-300/25 bg-amber-400/10 text-amber-300"
                          : "border-success/25 bg-success/10 text-success"
                  )}
                >
                  <FileIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-medium text-foreground">{e.name}</p>
                  <p className="text-[10px] text-muted-foreground">{meta.label} · {e.size}</p>
                </div>
              </div>
            );
          })}
        </div>
      </StageCard>
      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
        <span className="text-xs text-muted-foreground">Signatures extracted</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {["hydration", "mismatch", "useEffect", "SSR"].map((s) => (
            <Badge key={s} variant="secondary" className="text-[9px]">
              {s}
            </Badge>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sample evidence mirrors a real upload: screenshots, logs, code, and paste output. You can do the same with your
        own files.
      </p>
    </div>
  );
}

function AnalyzeView() {
  const stages = React.useMemo(() => [
    { label: "Understanding context", pct: 14 },
    { label: "Checking evidence", pct: 28 },
    { label: "Extracting error signatures", pct: 42 },
    { label: "Comparing similar cases", pct: 57 },
    { label: "Evaluating outcomes", pct: 71 },
    { label: "Ranking fixes", pct: 85 },
    { label: "Preparing recommendation", pct: 100 },
  ], []);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const timers = stages.map((_, i) => setTimeout(() => setActive(i + 1), 580 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [stages]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-4"
    >
      <span className="relative mb-4 grid size-14 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:2.4s]" />
        <Sparkles className="size-7" />
      </span>
      <p className="text-center text-sm font-medium text-foreground">White-box diagnosis</p>
      <p className="text-xs text-muted-foreground">No hidden chain-of-thought · high-level stages only</p>
      <div className="mt-5 w-full max-w-md space-y-1.5">
        {stages.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3.5 py-2 text-xs transition-colors",
              i < active
                ? "border-success/40 bg-success/5"
                : i === active
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent opacity-40"
            )}
          >
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border",
                i < active
                  ? "border-success/40 bg-success/15 text-success"
                  : i === active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground/50"
              )}
            >
              {i < active ? <Check className="size-3" /> : i === active ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1 rounded-full bg-current" />}
            </span>
            {s.label}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function MatchView() {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let f = 0;
    const id = setInterval(() => {
      f++;
      setCount(Math.round((f / 50) * 487));
      if (f >= 50) clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col items-center justify-center py-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Outcome graph</p>
      <span className="mt-3 font-heading text-6xl font-bold tabular-nums text-foreground">{count.toLocaleString()}</span>
      <p className="mt-1 text-sm text-muted-foreground">similar verified cases matched</p>
      <div className="mt-5 flex gap-2">
        {["Hydration mismatch", "Next.js", "React", "SSR"].map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
        ))}
      </div>
    </motion.div>
  );
}

function FixView() {
  const [done, setDone] = React.useState(0);
  React.useEffect(() => {
    const timers = FIX.steps.map((_, i) => setTimeout(() => setDone(i + 1), 1100 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mx-auto max-w-lg space-y-4">
      <StageCard className="p-5">
        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-linear-to-r from-violet-500/90 to-cyan-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Sparkles className="size-3" /> Top pick
        </span>
        <h3 className="font-heading text-lg font-semibold text-foreground">#{1} {FIX.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{FIX.why}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Success", `${FIX.successRate}%`, "text-success"],
            ["Match", `${FIX.matchScore}%`, ""],
            ["Confidence", FIX.confidence, "text-success"],
          ].map(([l, v, cls]) => (
            <div key={l} className="rounded-lg border border-border/60 bg-card/70 px-2.5 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
              <p className={cn("text-xs font-semibold text-foreground", cls)}>{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Risk {FIX.risk} · Effort {FIX.effort} · {FIX.time} · verified in 443 cases</p>
      </StageCard>

      <StageCard>
        <p className="text-xs text-muted-foreground">{done}/{FIX.steps.length} steps done</p>
        <Progress value={(done / FIX.steps.length) * 100} className="mt-2 w-full" />
        <ol className="mt-4 space-y-2.5">
          {FIX.steps.map((s, i) => {
            const ok = i < done;
            return (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                    ok ? "border-success bg-success text-white" : "border-border text-muted-foreground"
                  )}
                >
                  {ok ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cn("flex-1 text-sm leading-relaxed", ok ? "text-muted-foreground line-through" : "text-foreground")}>
                  {s}
                </span>
              </li>
            );
          })}
        </ol>
      </StageCard>
    </motion.div>
  );
}

function VerifyView() {
  const [done, setDone] = React.useState(false);
  return (
    <div className="mx-auto max-w-lg">
      {done ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center"
        >
          <div className="mx-auto grid size-12 place-items-center rounded-full border border-success/40 bg-success/10 text-success">
            <Check className="size-6" />
          </div>
          <p className="mt-3 font-heading text-lg font-semibold text-foreground">Verification complete</p>
          <p className="mt-1 text-xs text-muted-foreground">
            White-box verification only — no chain-of-thought was shown or stored.
          </p>
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
          <VerificationPanel
            title="Confirming the observation window, then writing the outcome to the graph."
            onComplete={() => setDone(true)}
          />
        </div>
      )}
    </div>
  );
}

function LearnView() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mx-auto max-w-lg space-y-3">
      <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What was learned</p>
        <ul className="mt-3 space-y-3">
          {LEARNING.map((l) => (
            <li key={l.text} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-300">
                <Icon name={l.icon} className="size-3.5" />
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{l.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-xs text-foreground">
        <MessageSquareQuote className="size-3.5 shrink-0 text-primary" />
        This outcome strengthens the same fix for anyone with the same environment.
      </p>
    </motion.div>
  );
}

function RewardView() {
  const router = useRouter();
  const isGuest = useGuestStore((s) => s.mode === "guest");
  const enterGuest = useGuestStore((s) => s.enterGuest);
  const openAuthGate = useGuestStore((s) => s.openAuthGate);

  const asGuest = () => {
    enterGuest();
    notify.success("Welcome, guest", "Keep exploring — you have 3 free AI runs.");
    router.push("/dashboard");
  };

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 18, stiffness: 120 }}
      className="mx-auto max-w-lg space-y-4 text-center"
    >
      <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan-400/20 [animation-duration:2.4s]" />
        <Coins className="size-8" />
      </div>
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">+8 FIX earned</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sample case outcome · reward unlocked on this account</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {isGuest ? (
          <>
            <Button render={<Link href="/dashboard" />}>
              <Trophy className="size-4" /> Open your dashboard
            </Button>
            <Button onClick={() => openAuthGate("Create an account to keep earning real FIX.")} variant="secondary">
              <UserPlus2 className="size-4" /> Create account
            </Button>
          </>
        ) : (
          <>
            <Button onClick={asGuest}>
              <Sparkles className="size-4" /> Continue as Guest
            </Button>
            <Button render={<Link href="/signup?next=/dashboard" />} variant="secondary">
              <UserPlus2 className="size-4" /> Create free account <ArrowRight className="size-4" />
            </Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {isGuest
          ? "Guests earn preview points instead of FIX. Sign up on this device to keep your progress."
          : "Guests earn preview points instead of FIX — the sample above shows the real reward."}
      </p>
    </motion.div>
  );
}

const VIEW: Record<Stage, React.ReactNode> = {
  Problem: <ProblemView />,
  Evidence: <EvidenceView />,
  "AI Analysis": <AnalyzeView />,
  Match: <MatchView />,
  Fix: <FixView />,
  Verify: <VerifyView />,
  Learn: <LearnView />,
  Reward: <RewardView />,
};

export function DemoWorkflow() {
  const [started, setStarted] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGuest = useGuestStore((s) => s.mode === "guest");
  const stage = STAGES[idx];

  const advance = React.useCallback(() => {
    setIdx((i) => Math.min(i + 1, STAGES.length - 1));
  }, []);

  const back = React.useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  React.useEffect(() => {
    if (!started || paused || idx === STAGES.length - 1) return;
    timerRef.current = setTimeout(advance, DURATIONS[stage]);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [started, idx, paused, stage, advance]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
      if (e.key === "ArrowRight" || e.key === "Enter") advance();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back]);

  const restart = () => {
    setIdx(0);
    setPaused(false);
  };

  const skipToReward = () => {
    setIdx(STAGES.length - 1);
    setPaused(false);
  };

  if (!started) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-primary/20 bg-linear-to-b from-primary/[0.07] to-transparent p-8 text-center ring-1 ring-primary/10"
      >
        <span className="grid size-14 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
          <Play className="size-6" />
        </span>
        <h2 className="mt-4 font-heading text-2xl font-semibold text-foreground">Watch a real fix get solved</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Walk through 8 stages — from problem to reward — as Puvexa diagnoses {CASE_TITLE.split(" caused by")[0]} in a
          sample case. It auto-plays; you can pause, step back, or jump around.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                i === 0 ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground"
              )}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>

        <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">
          {START_NOTES.map((n) => (
            <li key={n} className="flex items-start gap-2 text-left">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
              {n}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => setStarted(true)}>
            <Play className="size-4" /> Start walkthrough
          </Button>
          <Button size="lg" variant="ghost" onClick={skipToReward}>
            Skip to reward
          </Button>
        </div>
        {isGuest && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Exploring as guest — after the walkthrough, open your dashboard.
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="hidden lg:block">
        <nav className="sticky top-24 space-y-0">
          {STAGES.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <button
                key={s}
                onClick={() => {
                  setIdx(i);
                  setPaused(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 border-l-2 py-2 pl-3 text-left text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : done
                      ? "border-success text-foreground/80"
                      : "border-border text-muted-foreground/60"
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border text-[10px]",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-success bg-success text-white"
                        : "border-border"
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {s}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[26rem] rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div key={stage}>{VIEW[stage]}</motion.div>
        </AnimatePresence>
      </div>

      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="ghost" onClick={back} disabled={idx === 0}>
            <ArrowLeft className="size-4" /> Previous
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="ghost" onClick={advance} disabled={idx >= STAGES.length - 1}>
            Skip <ArrowRight className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={restart}>
            <RefreshCcw className="size-4" /> Replay
          </Button>
          <div className="flex-1" />
          <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono">Space</kbd> pause
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono">←</kbd>{" "}
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono">→</kbd> step
          </div>
        </div>
      </div>
    </div>
  );
}