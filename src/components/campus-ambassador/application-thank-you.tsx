"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EASE_OUT_EXPO } from "@/lib/motion";
import type { CampusAmbassadorApplication } from "@/lib/campus-ambassador/types";

function statusLabel(status: string) {
  return status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ApplicationThankYou({
  application,
}: {
  application: CampusAmbassadorApplication;
}) {
  const submitted = new Date(application.submittedAt);

  return (
    <div className="mx-auto max-w-xl text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        className="relative mx-auto mb-6 grid size-20 place-items-center rounded-full bg-success/15"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-success/30 [animation-duration:1.8s]"
        />
        <span className="absolute inset-0 rounded-full border-2 border-success/40" />
        <Check className="relative size-9 text-success" strokeWidth={3} />
      </motion.div>

      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Application received
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Thank you for applying to the Puvexa Campus Ambassador program. Our team will review
        your application and reach out to the{" "}
        <span className="font-medium text-foreground">email you provided</span> if you move
        forward. No action is needed from you right now.
      </p>

      <div className="mx-auto mt-6 grid max-w-md gap-3 rounded-2xl border border-border/70 bg-card/50 p-5 text-left sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Application ID</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{application.applicationId}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Submitted</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {submitted.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Status</p>
          <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <Sparkles className="size-3" /> {statusLabel(application.status)}
          </span>
        </div>
      </div>

      {application.lookupToken && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Keep this token handy to look up your application later:{" "}
          <span className="font-mono font-semibold text-foreground">{application.lookupToken}</span>
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="secondary" render={<Link href="/" />}>
          Back to home
        </Button>
        <Button variant="outline" render={<Link href="/diagnose" />}>
          Explore Puvexa <ArrowRight className="size-4" />
        </Button>
        <Button variant="ghost" render={<Link href="/programs/campus-ambassador" />}>
          View application
        </Button>
      </div>
    </div>
  );
}