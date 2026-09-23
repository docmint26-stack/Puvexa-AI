"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exchangeAuthCode, isSupabaseConfigured } from "@/lib/api/supabase";
import { establishApiSession } from "@/lib/api/services";

function friendlyOAuthError(error: string, description: string | null): string {
  if (error === "access_denied" || error === "cancelled") {
    return "The sign-in window was closed before authentication finished. Please try again.";
  }
  if (error === "server_error") {
    return "The authentication provider hit a temporary error. Please try again in a moment.";
  }
  if (error === "invalid_request") {
    return "This sign-in request is invalid or expired. Please sign in again.";
  }
  return description || "Authentication could not be completed. Please try again.";
}

/**
 * PKCE callback destination for OAuth sign-ins. Exchanges the auth code for a
 * persisted session, promotes it into the app workspace, then redirects home.
 * Renders a clear error state for cancelled/denied/flawed auth responses.
 */
export function AuthCallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"working" | "error">("working");
  const [error, setError] = React.useState("");
  const [canRetry, setCanRetry] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const complete = React.useCallback(
    async (next: string | null) => {
      const session = await establishApiSession();
      if (!session.ok) {
        setStatus("error");
        setError(session.error ?? "We couldn't sync your profile yet. Please try again.");
        setCanRetry(true);
        return;
      }
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
    },
    [router]
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (typeof window === "undefined") return;
      const search = new URLSearchParams(window.location.search);

      const oauthError = search.get("error");
      if (oauthError) {
        if (!cancelled) {
          setStatus("error");
          setError(friendlyOAuthError(oauthError, search.get("error_description")));
        }
        return;
      }

      const code = search.get("code");
      if (!code) {
        if (!cancelled) {
          setStatus("error");
          setError("This sign-in link is invalid or has expired. Please sign in again.");
        }
        return;
      }

      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setStatus("error");
          setError("Supabase is not configured for this environment. Please contact support.");
        }
        return;
      }

      const exchange = await exchangeAuthCode(code);
      if (cancelled) return;
      if (exchange.error) {
        setStatus("error");
        setError(exchange.error);
        return;
      }
      await complete(search.get("next"));
    })();
    return () => {
      cancelled = true;
    };
  }, [complete]);

  const retry = () => {
    setBusy(true);
    const next = new URLSearchParams(window.location.search).get("next");
    void complete(next).finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="relative overflow-hidden p-0 shadow-2xl shadow-primary/10">
        <CardHeader className="px-6 pt-7 text-center sm:px-8">
          <CardTitle className="mx-auto font-heading text-xl font-semibold text-foreground">
            {status === "working" ? "Completing sign-in" : "Sign-in didn't finish"}
          </CardTitle>
          <CardDescription>
            {status === "working"
              ? "We're setting up your workspace."
              : "There was a problem with your authentication."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 sm:px-8">
          {status === "working" && (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Verifying your sign-in…
            </p>
          )}

          {status === "error" && (
            <>
              <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
              {canRetry && (
                <Button type="button" variant="outline" className="w-full" onClick={retry} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Try again"}
                </Button>
              )}
              <Button type="button" className="w-full" onClick={() => router.replace("/login")}>
                Back to sign in
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link href="/" className="font-medium text-primary hover:underline">
                  Go to home
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}