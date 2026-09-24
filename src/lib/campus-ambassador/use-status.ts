"use client";

import * as React from "react";
import { ambassadorService } from "@/lib/services";
import type { CampusAmbassadorApplication } from "./types";

export interface AmbassadorStatus {
  application: CampusAmbassadorApplication | null;
  loading: boolean;
}

/** Loads the current user's campus ambassador application status (if any). */
export function useAmbassadorApplication(): AmbassadorStatus {
  const [application, setApplication] = React.useState<CampusAmbassadorApplication | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    ambassadorService
      .getMyApplication()
      .then((app) => {
        if (!cancelled) setApplication(app);
      })
      .catch(() => {
        /* non-fatal — the UI just shows "apply" */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { application, loading };
}