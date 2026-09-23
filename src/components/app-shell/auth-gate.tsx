"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated, useAuthStore } from "@/lib/state/auth";
import { useGuestStore } from "@/lib/state/guest";
import { useTourStore } from "@/lib/state/ui";
import { usePathname } from "next/navigation";
import { isDemoMode } from "@/lib/services";
import { restoreSession, watchAuthState } from "@/lib/api/bootstrap";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const authed = useIsAuthenticated();
  const isGuest = useGuestStore((s) => s.mode === "guest");
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (isDemoMode) {
      // Demo mode reads directly from the persisted auth store. Guests may
      // pass through the gate — their session is local-only and touches no
      // protected API.
      if (!authed && !isGuest) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    // Production: restore the persisted Supabase session, then gate.
    void restoreSession().then(() => {
      if (!useAuthStore.getState().user && !isGuest) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });
    const unsubscribe = watchAuthState();
    return () => unsubscribe();
  }, [authed, isGuest, router, pathname]);

  if (!authed && !isGuest) return null;
  return <>{children}</>;
}

export function FirstLoginTour({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGuest = useGuestStore((s) => s.mode === "guest");
  React.useEffect(() => {
    if (pathname === "/dashboard" && !isGuest) {
      const t = setTimeout(() => {
        const { seen, start } = useTourStore.getState();
        if (!seen) start();
      }, 900);
      return () => clearTimeout(t);
    }
  }, [pathname, isGuest]);
  return <>{children}</>;
}