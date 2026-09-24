"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, ExternalLink, FileText, Menu, X } from "lucide-react";
import * as React from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/shared/icon";
import { GitHubMark } from "@/components/shared/github-mark";
import { AnimatedCounter, RotatingWords, Reveal } from "@/components/shared/motion";
import { TokenBadge } from "@/components/shared/token-badge";
import { LiveDiagnosisPanel } from "@/components/diagnose/live-diagnosis-panel";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { TopProblemsSection } from "@/components/landing/top-problems-section";
import { ProgramsSection } from "@/components/landing/programs-section";
import { useGuestStore } from "@/lib/state/guest";
import { notify } from "@/lib/feedback";
import { landingStats, howItWorksSteps, features, testimonials, tokenEconomy, heroRotating } from "@/lib/data";
import { avatarGradient } from "@/lib/format";

const NAV_LINKS = [
  { label: "Problems", href: "#top-problems" },
  { label: "Features", href: "#features" },
  { label: "Programs", href: "#programs" },
  { label: "Leaderboard", href: "#leaderboard" },
  { label: "Token", href: "#token" },
  { label: "Faq", href: "#faq" },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const router = useRouter();
  const enterGuest = useGuestStore((s) => s.enterGuest);

  const tryAsGuest = () => {
    enterGuest();
    notify.success("Welcome, guest", "Preview Puvexa with 3 free AI runs — no account needed.");
    router.push("/dashboard");
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid-faint opacity-50" />

      {/* Navbar */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" render={<Link href="/how-it-works" />}>
              Workflow
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/login" />}>
              Sign in
            </Button>
            <Button size="sm" render={<Link href="/signup" />}>
              Get started <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </nav>
        {menuOpen && (
          <div className="border-t border-border/50 bg-background/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex gap-2">
                <Button variant="ghost" className="flex-1" render={<Link href="/how-it-works" />}>
                  Workflow
                </Button>
                <Button variant="ghost" className="flex-1" render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button className="flex-1" render={<Link href="/signup" />}>
                  Get started
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 sm:pt-40">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-[560px] w-[820px] max-w-full -translate-x-1/2 rounded-full bg-linear-to-r from-violet-600/20 via-primary/10 to-cyan-500/20 blur-3xl" />

        <div className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-[10px]">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              Live on FIX Testnet · Sepolia
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mx-auto mt-6 max-w-3xl font-heading text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl"
          >
            Troubleshoot anything.{" "}
            <span className="bg-linear-to-r from-violet-400 via-primary to-cyan-400 bg-clip-text text-transparent">
              Earn while you fix.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mx-auto mt-4 font-heading text-lg font-medium text-cyan-300 sm:text-xl"
          >
            <RotatingWords words={heroRotating} />
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Puvexa diagnoses your problem against millions of verified cases, ranks the fix most
            likely to work for{" "}
            <RotatingWords words={["your environment", "your stack", "your build", "your device"]} className="text-foreground font-medium" />
            , and rewards the humans who make it work.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button size="lg" className="h-11 px-5" onClick={tryAsGuest}>
              Try Puvexa <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="secondary" className="h-11 px-5" render={<Link href="/how-it-works" />}>
              Workflow
            </Button>
            <Button size="sm" variant="ghost" className="h-11 px-3 text-muted-foreground" render={<Link href="/signup" />}>
              Create a free account
            </Button>
          </motion.div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Try instantly as a guest — no account, 3 free AI Lab runs.
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4"
          >
            {landingStats.map((s) => (
              <div key={s.label}>
                <p className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  <AnimatedCounter value={s.value} suffix={s.value >= 1000000 ? "M+" : s.value >= 10000 ? "+" : ""} />
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Hero mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="relative mx-auto mt-14 max-w-3xl"
        >
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-linear-to-b from-primary/20 to-cyan-400/10 opacity-70 blur-md" />
          <div className="relative rounded-2xl border border-border/70 bg-card/80 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <LiveDiagnosisPanel context="Windows 11 · onboard WLAN · battery" matchedSignatures={3} reward={70} />
          </div>
        </motion.div>
      </section>

      {/* Top Searching Problems */}
      <TopProblemsSection />

      {/* Problem / Solution */}
      <section className="relative border-y border-border/50 bg-card/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">The problem</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Troubleshooting is unbounded guesswork.
              </h2>
              <div className="mt-5 space-y-3 text-muted-foreground">
                {[
                  "Generic search results ignore your panel, OS build, and stack.",
                  "Stack Overflow answers age out — and confusion outweighs votes.",
                  "Nobody rewards the humans behind the fixes that actually solve it.",
                ].map((t) => (
                  <p key={t} className="flex items-start gap-2.5 text-sm">
                    <X className="mt-0.5 size-4 shrink-0 text-destructive/70" /> {t}
                  </p>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Toward Proof-of-Help</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Verified fixes. On-chain credibility.
              </h2>
              <div className="mt-5 space-y-3 text-muted-foreground">
                {[
                  "Diagnosis maps your exact context to proven, verified patterns.",
                  "Fixes are ranked by success rate, confidence, and effort — not votes.",
                  "Contributors earn FIX royalties every time a verified fix is reused.",
                ].map((t) => (
                  <p key={t} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {t}
                  </p>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="leaderboard" className="relative mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:px-6">
        <LeaderboardContent />
      </section>

      {/* Workflow */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Workflow</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From symptom to verified fix
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Five steps, one closed loop. Every step feeds the next — and the network learns from it.
          </p>
        </div>

        <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-linear-to-r from-transparent via-primary/30 to-transparent lg:block" />
          {howItWorksSteps.map((step, i) => (
            <Reveal key={step.step} delay={i * 0.06}>
              <div className="group relative rounded-xl border border-border/70 bg-card/50 p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:border-primary/30">
                <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 font-heading text-sm font-bold text-primary">
                  {step.step}
                </span>
                <Icon name={step.icon} className="absolute right-3 top-3 size-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                <p className="mt-3 text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-y border-border/50 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Features</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything a fixer needs
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Built for people who solve real problems — and want that work to count.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="group h-full rounded-xl border border-border/70 bg-card/50 p-5 ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <Icon name={f.icon} className="size-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Our Programs */}
      <ProgramsSection />

      {/* Token economy */}
      <section id="token" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-border/70 bg-linear-to-br from-violet-500/10 via-card/50 to-cyan-400/10 p-8 ring-1 ring-primary/10 sm:p-12">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">FIX token economy</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Help becomes capital
              </h2>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                FIX isn&apos;t a reward points system. It&apos;s an open economy for verified knowledge.
              </p>
            </div>
            <TokenBadge value={2400000} className="text-cyan-300" />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tokenEconomy.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.06}>
                <div className="h-full rounded-xl border border-border/60 bg-card/60 p-5 transition-colors hover:border-primary/30">
                  <span className="grid size-10 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
                    <Icon name={t.icon} className="size-4" />
                  </span>
                  <p className="mt-3 font-heading text-base font-semibold text-foreground">{t.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {t.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                        <Check className="mt-0.5 size-3 shrink-0 text-success" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Fixers speak</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built by people who fix, for people who fix
            </h2>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.handle} delay={i * 0.06}>
                <figure className="flex h-full flex-col rounded-xl border border-border/70 bg-card/50 p-5 ring-1 ring-foreground/5">
                  <div className="flex gap-0.5 text-amber-300">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Icon key={s} name="star" className="size-3.5" />
                    ))}
                  </div>
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
                    &quot;{t.quote}&quot;
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-2.5 border-t border-border/60 pt-4">
                    <Avatar size="sm">
                      <AvatarFallback className={cn("bg-linear-to-br text-[10px] text-white", avatarGradient(t.handle))}>
                        {t.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{t.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{t.role}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-cyan-300">{t.earned}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Faq</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {[
            {
              q: "Is Puvexa free right now?",
              a: "Yes. During the testnet, diagnosis is 100% free. Contributors genuinely earn FIX for verified fixes that get reused.",
            },
            {
              q: "What does verification actually mean?",
              a: "A fix is only trusted after evidence-backed proof — logs, screenshots, or peer review signatures from other fixers. Trust follows verified outcomes.",
            },
            {
              q: "How do royalties work?",
              a: "When your verified fix is reused by other users, the network settles recurring FIX royalties to your wallet. Attribution is kept on-chain.",
            },
            {
              q: "Is my problem data private?",
              a: "Logs and screenshots are hashed locally before upload. Raw evidence never leaves your device unless you choose to publish a walkthrough.",
            },
          ].map((item, i) => (
            <Reveal key={item.q} delay={i * 0.04}>
              <details className="group rounded-xl border border-border/70 bg-card/50 p-4 ring-1 ring-foreground/5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                  {item.q}
                  <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/50">
        <div className="relative mx-auto max-w-6xl overflow-hidden px-4 py-20 sm:px-6">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-linear-to-r from-violet-600/20 to-cyan-500/20 blur-3xl" />
          <div className="relative text-center">
            <h2 className="mx-auto max-w-2xl font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Stop guessing. <span className="text-gradient-strong">Start fixing.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
              Join the network where verified knowledge compounds — and the people behind it get paid.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-11 px-6" render={<Link href="/signup" />}>
                Create free account <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="secondary" className="h-11 px-6" render={<Link href="/how-it-works" />}>
                <Icon name="sparkles" className="size-4" /> Watch How Puvexa Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30">
        <section aria-label="Pitch and whitepaper" className="mx-auto grid max-w-6xl gap-4 px-4 pt-10 sm:grid-cols-2 sm:px-6">
          {[
            { label: "Investor & Product Deck", description: "Explore the Puvexa AI investor and product deck.", href: "/documents/puvexa-ai-pitch.pdf" },
            { label: "Whitepaper v1.0", description: "Read the Puvexa AI whitepaper v1.0.", href: "/documents/puvexa-ai-whitepaper.pdf" },
          ].map((document) => (
            <div key={document.label} className="rounded-2xl border border-border/60 bg-card/50 p-5">
              <h2 className="font-heading text-lg font-semibold text-foreground">{document.label}:</h2>
              <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
              <Button variant="secondary" className="mt-4" render={<a href={document.href} target="_blank" rel="noopener noreferrer" aria-label={`Download ${document.label} PDF in a new tab`} />}>
                <FileText className="size-4" /> Download {document.label} <ExternalLink className="size-3.5" />
              </Button>
            </div>
          ))}
        </section>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-2 max-w-xs text-[11px] text-muted-foreground">
              AI-powered troubleshooting with verified fixes and on-chain knowledge royalties.
            </p>
          </div>
          <nav aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="text-sm font-normal uppercase text-muted-foreground">Contact us</h2>
            <ul className="mt-6 space-y-3">
              {[
                { label: "X / Twitter", href: "https://x.com/Puvexa" },
                { label: "Telegram", href: "https://linktr.ee/puvexa" },
                { label: "Linktree", href: "https://linktr.ee/puvexa" },
              ].map((contact) => (
                <li key={contact.label}>
                  <a href={contact.href} target="_blank" rel="noopener noreferrer" className="rounded-sm text-base text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                    {contact.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" render={<a className="text-muted-foreground" href="https://github.com/docmint26-stack/Puvexa-AI" target="_blank" rel="noreferrer" />}>
              <GitHubMark className="size-3.5" /> GitHub
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              Docs
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" render={<a href="/documents/puvexa-ai-whitepaper.pdf" target="_blank" rel="noopener noreferrer" />}>
              Whitepaper
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              Status
            </Button>
          </div>
        </div>
        <div className="border-t border-border/50 py-4 text-center text-[10px] text-muted-foreground">
          FIX is a testnet token. Nothing here is financial advice. © 2026 Puvexa AI.
        </div>
      </footer>
    </div>
  );
}
