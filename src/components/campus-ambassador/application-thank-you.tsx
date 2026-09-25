"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, House } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EASE_OUT_EXPO } from "@/lib/motion";
import type { StoredAmbassadorApplication } from "@/lib/campus-ambassador/types";

function statusLabel(status: string) {
  return status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const CONFETTI = [
  { angle: -70, distance: 70, delay: 0.05, color: "bg-violet-400" },
  { angle: -35, distance: 84, delay: 0.12, color: "bg-cyan-400" },
  { angle: -12, distance: 78, delay: 0.18, color: "bg-success" },
  { angle: 12, distance: 80, delay: 0.24, color: "bg-cyan-400" },
  { angle: 35, distance: 86, delay: 0.3, color: "bg-violet-400" },
  { angle: 70, distance: 70, delay: 0.36, color: "bg-success" },
];

export function ApplicationThankYou({
  application,
}: {
  application: StoredAmbassadorApplication;
}) {
  const submitted = new Date(application.submittedAt);
  const date = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(submitted);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(submitted);
  const university = application.details?.institution;

  return (
    <div className="mx-auto max-w-xl text-center">
      {/* Gradient glow behind the success mark */}
      <div className="relative mx-auto mb-8 grid size-32 place-items-center">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-br from-violet-500/30 via-success/15 to-cyan-400/25 blur-2xl" />
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          className="relative grid size-20 place-items-center rounded-full bg-success/15"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full bg-success/30 [animation-duration:1.8s]"
          />
          <span className="absolute inset-0 rounded-full border-2 border-success/40" />
          <Check className="relative size-9 text-success" strokeWidth={3} />
        </motion.div>

        {/* Lightweight one-time confetti */}
        {CONFETTI.map((c) => (
          <motion.span
            key={c.angle}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: 1, x: Math.cos((c.angle * Math.PI) / 180) * c.distance, y: Math.sin((c.angle * Math.PI) / 180) * c.distance }}
            transition={{ delay: 0.35 + c.delay, duration: 0.9, ease: "easeOut" }}
            className={`absolute size-1.5 rounded-full ${c.color}`}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: EASE_OUT_EXPO }}
      >
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Application Submitted Successfully
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Thank you for applying to the Puvexa Campus Ambassador Program.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT_EXPO }}
        className="mx-auto mt-6 max-w-md rounded-2xl border border-border/70 bg-card/50 p-5 text-left"
      >
        <div className="grid gap-4">
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Application ID</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">
              {application.applicationId}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Status</p>
              <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                <Check className="size-3" /> {statusLabel(application.status)}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Submitted</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                {date} • {time}
              </p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Applicant</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{application.fullName}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">University</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{university ?? "—"}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-5 space-y-1.5 text-xs leading-relaxed text-muted-foreground"
      >
        <p>
          Your application has been successfully submitted in this application experience.
        </p>
        <p>We&apos;re excited to see your interest in representing Puvexa on your campus.</p>
        <p className="font-medium text-foreground/80">
          Your application details have been saved on this device.
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          Application syncing with the Puvexa review system will be available in a future update.
        </p>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/dashboard" />}>
          Explore Puvexa <ArrowRight className="size-4" />
        </Button>
        <Button variant="secondary" render={<Link href="/programs/campus-ambassador/application" />}>
          View application
        </Button>
        <Button variant="ghost" render={<Link href="/" />}>
          <House className="size-4" /> Back to home
        </Button>
      </div>
    </div>
  );
}