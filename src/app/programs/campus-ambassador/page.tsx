import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, GraduationCap } from "lucide-react";

import { Icon } from "@/components/shared/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AmbassadorApplyCta } from "@/components/campus-ambassador/apply-cta";

export const metadata: Metadata = {
  title: "Campus Ambassador Program",
  description:
    "Champion Puvexa at your university. Host events, help students diagnose and fix real problems, and grow the Puvexa network on campus.",
  openGraph: {
    title: "Puvexa Campus Ambassador Program",
    description:
      "A leadership experience for students who love solving technical problems — launch, learn, and grow with Puvexa.",
    type: "website",
  },
};

const EXPECTED = [
  {
    icon: "megaphone",
    title: "Lead at campus scale",
    points: [
      "Host one Puvexa workshop or demo session each term",
      "Run a campus troubleshooting group or office hours",
      "Share verified-fix culture with your CS, IT, and maker clubs",
    ],
  },
  {
    icon: "users",
    title: "Build a community",
    points: [
      "Grow a local community of problem-solvers",
      "Help students with real diagnosis and fix walkthroughs",
      "Collect feedback that shapes the product",
    ],
  },
  {
    icon: "sparkles",
    title: "Grow your skills",
    points: [
      "Practice mentoring, public speaking, and technical writing",
      "Earn a verified Puvexa Campus Ambassador certificate",
      "Get early access to features and direct founder Q&As",
    ],
  },
];

const WHO = [
  {
    icon: "users",
    title: "Community builders",
    description: "You already host meetups, hackathons, or study groups and want to grow that habit.",
  },
  {
    icon: "graduation-cap",
    title: "Students who love fixing",
    description: "You answer questions in class, in clubs, or on campus forums — teaching is your superpower.",
  },
  {
    icon: "megaphone",
    title: "Campus communicators",
    description: "You can take a clear message to the right audience — clubs, departments, and social groups.",
  },
  {
    icon: "rocket",
    title: "Early-career builders",
    description: "You want real, verifiable leadership experience and a network that lasts past graduation.",
  },
];

const SELECTION = [
  { step: "01", title: "Apply online", description: "A 10-minute form about you, your campus, and your goals." },
  { step: "02", title: "We review", description: "Every application is read by a human. No algorithms, no auto-rejects." },
  { step: "03", title: "Short conversation", description: "A quick, friendly 20-minute call to learn about you." },
  { step: "04", title: "Welcome aboard", description: "Get onboarded with a starter kit and your first 30-day plan." },
];

const FAQ = [
  {
    q: "How much time does this require?",
    a: "We ask for roughly 3–5 hours a month — one event and a few short activities. You decide the pace with your advisor.",
  },
  {
    q: "Do I need to be a tech expert?",
    a: "No. The most effective ambassadors are curious and reliable. Puvexa supports you with guided fix walkthroughs and templates.",
  },
  {
    q: "Is this paid or an internship?",
    a: "It's a leadership and skills program. There's no salary or fee — you gain verified experience, mentorship, and early access.",
  },
  {
    q: "Can I join if I'm not enrolled full-time?",
    a: "The program is open to current students, recent graduates, and campus club organizers. Apply and tell us about your situation.",
  },
  {
    q: "How long will I serve as an ambassador?",
    a: "Terms run one academic semester (approx. 4–5 months). Strong ambassadors are invited to renew for the next term.",
  },
];

export default function CampusAmbassadorPage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="relative text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] max-w-full -translate-x-1/2 rounded-full bg-linear-to-r from-violet-600/20 via-primary/10 to-cyan-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-[10px] text-primary">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              Applications open — term starting soon
            </Badge>
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl font-heading text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
            Become a <span className="bg-linear-to-r from-violet-400 via-primary to-cyan-400 bg-clip-text text-transparent">Puvexa</span> Campus
            Ambassador
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Lead the troubleshooting community on your campus. Help students fix real problems, learn to teach
            effectively, and earn verifiable leadership experience with Puvexa.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="h-11 px-6" render={<Link href="/programs/campus-ambassador/apply" />}>
              Apply now <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="secondary" className="h-11 px-6" render={<a href="#what-youll-do" />}>
              See what&apos;s involved
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            No financial reward or job is promised — this is a hands-on leadership experience.
          </p>
          <AmbassadorApplyCta />
        </div>
      </section>

      {/* What you'll do */}
      <section id="what-youll-do" className="scroll-mt-24">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">What you&apos;ll do</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            A real role with a real impact
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Three focus areas, one goal: make your campus better at solving technical problems.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPECTED.map((item) => (
            <div key={item.title} className="group h-full rounded-xl border border-border/70 bg-card/50 p-5 ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:border-primary/30">
              <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <Icon name={item.icon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">{item.title}</p>
              <ul className="mt-3 space-y-2">
                {item.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Who should apply */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Who should apply</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              You don&apos;t need to be a tech genius
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              You just need to be curious, reliable, and excited about helping people around you.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w) => (
              <div key={w.title} className="rounded-xl border border-border/70 bg-card/50 p-4 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
                  <Icon name={w.icon} className="size-4" />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">{w.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{w.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Selection process */}
      <section>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Selection process</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, human, transparent
          </h2>
        </div>
        <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-linear-to-r from-transparent via-primary/30 to-transparent lg:block" />
          {SELECTION.map((s) => (
            <div key={s.step} className="relative rounded-xl border border-border/70 bg-card/50 p-4 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 font-heading text-sm font-bold text-primary">
                {s.step}
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Faq</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl border border-border/70 bg-card/50 p-4 ring-1 ring-foreground/5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                {item.q}
                <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/50">
        <div className="relative mx-auto max-w-6xl overflow-hidden px-4 py-16 sm:px-6">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-linear-to-r from-violet-600/20 to-cyan-500/20 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <GraduationCap className="size-6" />
            </span>
            <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ready to lead the fixers on your campus?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              The application takes about 10 minutes. We read every single one.
            </p>
            <Button size="lg" className="mt-8 h-11 px-6" render={<Link href="/programs/campus-ambassador/apply" />}>
              Start your application <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}