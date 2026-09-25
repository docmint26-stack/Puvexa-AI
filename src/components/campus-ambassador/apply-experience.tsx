"use client";

import { useAmbassadorApplication } from "@/lib/campus-ambassador/use-status";
import type { StoredAmbassadorApplication } from "@/lib/campus-ambassador/types";
import { AlreadyAppliedView } from "./already-applied";
import { AmbassadorApplicationForm } from "./ambassador-application-form";

/**
 * Decides what the /apply route shows based on what is stored on this device:
 * the form for new applicants, or a "you've already applied" state for
 * returning visitors.
 */
export function AmbassadorApplyExperience() {
  const { application, loading } = useAmbassadorApplication();

  if (loading) {
    return (
      <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-2xl border border-border/70 bg-card/40" />
    );
  }

  if (application) {
    return <AlreadyAppliedView application={application as StoredAmbassadorApplication} />;
  }

  return <AmbassadorApplicationForm />;
}