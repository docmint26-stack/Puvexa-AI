"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthActions } from "@/lib/hooks";
import { applyRecoveryCode, applyRecoverySession } from "@/lib/api/supabase";
import { notify } from "@/lib/feedback";

const inputClass =
  "w-full rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuthActions();

  const [state, setState] = React.useState<"resolving" | "error" | "ready">("resolving");
  const [stateError, setStateError] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const { error } = code ? await applyRecoveryCode(code) : await applyRecoverySession(window.location.hash);
      if (error) {
        setState("error");
        setStateError(error);
      } else {
        setState("ready");
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = updatePassword ? await updatePassword(password) : null;
      if (res && !res.ok) {
        setError(res.error ?? "Could not update the password. Please try again.");
        setLoading(false);
        return;
      }
      notify.success("Password updated", "Sign in with your new password.");
      router.replace("/login");
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="relative overflow-hidden p-0 shadow-2xl shadow-primary/10">
        <CardHeader className="px-6 pt-7 text-center sm:px-8">
          <CardTitle className="mx-auto font-heading text-xl font-semibold text-foreground">Choose a new password</CardTitle>
          <CardDescription>Your recovery link was verified. Set a fresh password to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 sm:px-8">
          {state === "resolving" && (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Verifying your recovery link…
            </p>
          )}

          {state === "error" && (
            <>
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{stateError}</p>
              <Button type="button" variant="outline" className="w-full" onClick={() => router.replace("/forgot-password")}>
                Request a new reset link
              </Button>
            </>
          )}

          {state === "ready" && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">New password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Confirm new password</label>
                <input
                  required
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}