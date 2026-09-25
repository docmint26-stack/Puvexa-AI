"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAmbassadorApplication } from "@/lib/campus-ambassador/use-status";

export function AmbassadorApplyCta({
  showOpenCta = true,
}: {
  showOpenCta?: boolean;
}) {
  const { application, loading } = useAmbassadorApplication();

  if (loading) {
    return (
      <div className="mx-auto mt-6 h-[76px] max-w-sm animate-pulse rounded-2xl border border-border/70 bg-card/40" />
    );
  }

  if (!application && !showOpenCta) return null;

  return (
    <div className="mx-auto mt-6 max-w-md text-left">
      {application ? (
        <div className="group flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                You&apos;ve already applied
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {application.applicationId} · Submitted ·{" "}
                {new Date(application.submittedAt).toLocaleDateString()}
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            render={<Link href="/programs/campus-ambassador/application" />}
          >
            View application <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/40 p-5 sm:flex-row sm:justify-between">
          <p className="text-sm font-semibold text-foreground">
            Ready to build your first tech community?
          </p>
          <Button render={<Link href="/programs/campus-ambassador/apply" />}>
            Apply now <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}