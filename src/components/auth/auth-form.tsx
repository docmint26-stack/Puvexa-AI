"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { GitHubMark } from "@/components/shared/github-mark";
import { useAuthActions } from "@/lib/hooks";
import { useGuestStore } from "@/lib/state/guest";
import { useAuthProviders } from "@/lib/hooks/use-auth-providers";
import { isSupabaseConfigured, signInWithProvider } from "@/lib/api/supabase";
import { DEMO_CREDENTIALS, DEMO_MODE } from "@/lib/demo/users";
import { notify } from "@/lib/feedback";

const inputClass =
  "w-full rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : null;
}

export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" }) {
  const router = useRouter();
  const { login, signup, requestPasswordReset } = useAuthActions();
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(DEMO_MODE ? DEMO_CREDENTIALS.email : "");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState(DEMO_MODE ? DEMO_CREDENTIALS.password : "");

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const { settings, loading: settingsLoading } = useAuthProviders();
  const [busy, setBusy] = React.useState<"google" | "github" | null>(null);

  const canStart = !DEMO_MODE && isSupabaseConfigured();
  const googleAvailable = settings?.google === true;
  const githubAvailable = settings?.github === true;
  const googleDisabled = !canStart || !googleAvailable || settingsLoading || busy === "github";
  const githubDisabled = !canStart || !githubAvailable || settingsLoading || busy === "google";

  const startOAuth = async (provider: "google" | "github") => {
    if (settings?.google !== true && provider === "google") {
      setError("Google sign-in is not enabled in this environment.");
      return;
    }
    if (settings?.github !== true && provider === "github") {
      setError("GitHub sign-in is not enabled in this environment.");
      return;
    }
    setError("");
    setBusy(provider);
    const { url, error } = await signInWithProvider(provider, `${window.location.origin}/auth/callback`);
    if (error) {
      setError(error);
      setBusy(null);
      return;
    }
    if (!url) {
      setError("Could not reach the sign-in provider. Please try again.");
      setBusy(null);
      return;
    }
    window.location.assign(url);
  };

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError("");
    notify.info("Demo credentials filled", "Just hit Sign in to explore the app.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgot) {
      setError("");
      setLoading(true);
      try {
        const redirectTo = `${window.location.origin}/reset-password`;
        const res = requestPasswordReset ? await requestPasswordReset(email, redirectTo) : null;
        if (res && !res.ok) {
          setError(res.error ?? "Could not send a reset link. Please try again.");
          setLoading(false);
          return;
        }
        setSent(true);
      } catch {
        setError("Unexpected error. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = isLogin
        ? await login(email, password)
        : await signup({
            name: name.trim() || email.split("@")[0],
            email,
            username: (username.trim() || email.split("@")[0]).replace(/[^a-z0-9_]/gi, "").toLowerCase(),
            password,
          });

      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      notify.success(isLogin ? "Welcome back" : "Account created", "Loading your workspace…");
      const next = safeNext();
      router.replace(next ?? "/dashboard");
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="relative overflow-hidden p-0 shadow-2xl shadow-primary/10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-violet-500/10 blur-3xl" />
        <CardHeader className="px-6 pt-7 text-center sm:px-8">
          <CardTitle className="mx-auto font-heading text-xl font-semibold text-foreground">
            {isForgot ? "Reset your password" : isLogin ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {isForgot
              ? "Enter your email and we'll send a one-time reset link."
              : isLogin
                ? "Sign in to continue fixing — and earning FIX."
                : "Start diagnosing, contributing, and earning on-chain."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 sm:px-8">
          {DEMO_MODE && !isForgot && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Wand2 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground">Demo environment</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
                </p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={fillDemo}>
                Use demo
              </Button>
            </div>
          )}

          {!isForgot && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={googleDisabled}
                  onClick={() => {
                    if (!canStart || !googleAvailable) {
                      setError("Google sign-in is not enabled in this environment.");
                      return;
                    }
                    void startOAuth("google");
                  }}
                >
                  {busy === "google" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="grid size-4 place-items-center rounded-full bg-linear-to-br from-red-400 to-blue-500 text-[9px] font-bold text-white">G</span>
                      Google
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={githubDisabled}
                  onClick={() => {
                    if (!canStart || !githubAvailable) {
                      setError("GitHub sign-in is not enabled in this environment.");
                      return;
                    }
                    void startOAuth("github");
                  }}
                >
                  {busy === "github" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <GitHubMark className="size-4" /> GitHub
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or with email</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alexmorgan"
                    className={inputClass}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            {!isForgot && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">Password</label>
                  {isLogin && (
                    <Link href="/forgot-password" className="text-[11px] font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(inputClass, isLogin && DEMO_MODE && "font-mono")}
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            {sent && (
              <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                If an account exists for this email, a reset link is on its way.
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {isLogin ? "Signing in…" : "Working…"}
                </>
              ) : isForgot ? (
                "Send reset link"
              ) : isLogin ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          {!isForgot && (
            <p className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground">
              <Icon name="shield-check" className="size-3.5 shrink-0 text-success" />
              Password never leaves your device — wallets remain self-custodied.
            </p>
          )}

          {!isForgot && (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or explore</span>
                <Separator className="flex-1" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  useGuestStore.getState().enterGuest();
                  notify.success("Welcome, guest", "Preview Puvexa with 3 free AI runs — no account needed.");
                  router.replace(safeNext() ?? "/dashboard");
                }}
              >
                <Sparkles className="size-4 text-violet-500" />
                Continue as Guest
                <span className="ml-auto rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  no account
                </span>
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Guest exploring is local &amp; free. Guest Points are a preview only — they are not FIX.
              </p>
            </>
          )}
        </CardContent>

        <CardFooter className="justify-center px-6 pb-7 pt-1 sm:px-8">
          <p className="text-xs text-muted-foreground">
            {isLogin || isForgot ? (
              <>
                New to Puvexa?{" "}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}