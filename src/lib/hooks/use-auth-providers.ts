"use client";

import * as React from "react";
import { fetchAuthProviderSettings, isSupabaseConfigured, type AuthProviderSettings } from "@/lib/api/supabase";

let cached: Promise<AuthProviderSettings | null> | null = null;

function loadSettings(): Promise<AuthProviderSettings | null> {
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  if (!cached) {
    cached = fetchAuthProviderSettings().finally(() => {
      cached = null;
    });
  }
  return cached;
}

/**
 * Returns which social auth providers the Supabase project allows sign-in with.
 * Availability is read from `GET /auth/v1/settings` (fallback: email only).
 */
export function useAuthProviders(): { settings: AuthProviderSettings | null; loading: boolean } {
  const [state, setState] = React.useState<{ settings: AuthProviderSettings | null; loading: boolean }>({
    settings: null,
    loading: true,
  });

  React.useEffect(() => {
    let active = true;
    void loadSettings().then((settings) => {
      if (active) setState({ settings, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}