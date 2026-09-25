"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EASE_OUT_EXPO } from "@/lib/motion";
import type { StoredAmbassadorApplication } from "@/lib/campus-ambassador/types";

export function AlreadyAppliedView({
  application,
}: {
  application: StoredAmbassadorApplication;
}) {
  const submitted = new Date(application.submittedAt);
  const date = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(submitted);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
      className="mx-auto max-w-xl text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        className="relative mx-auto mb-6 grid size-20 place-items-center rounded-full bg-success/15"
      >
        <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-success/30 [animation-duration:2.4s]" />
        <span className="absolute inset-0 rounded-full border-2 border-success/40" />
        <CheckCircle2 className="relative size-9 text-success" strokeWidth={2.5} />
      </motion.div>

      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        You&apos;ve already applied
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Your campus ambassador application is submitted and saved on this device.
        Thank you for your interest in representing Puvexa on your campus.
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border/70 bg-card/50 p-5 text-left">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Application ID</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">{application.applicationId}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Status</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
              Submitted
            </span>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Submitted</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{date}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/programs/campus-ambassador/application" />}>
          View application <ArrowRight className="size-4" />
        </Button>
        <Button variant="ghost" render={<Link href="/programs/campus-ambassador" />}>
          <ArrowLeft className="size-4" /> Back to program
        </Button>
      </div>
    </motion.div>
  );
}