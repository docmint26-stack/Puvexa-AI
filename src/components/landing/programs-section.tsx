"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared/icon";
import { Reveal } from "@/components/shared/motion";
import { useAmbassadorApplication } from "@/lib/campus-ambassador/use-status";
import { programs } from "@/lib/data";

export function ProgramsSection() {
  const { application: ambassadorApplication } = useAmbassadorApplication();

  return (
    <section id="programs" className="scroll-mt-20 border-y border-border/50 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Our programs</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Learn, lead, and level up with Puvexa
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Hands-on ways to grow around troubleshooting — from leading your campus community to contributing
            verified fixes that help people around the world.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p, i) => {
            const applied = p.id === "campus-ambassador" && ambassadorApplication != null;

            return (
            <Reveal key={p.id} delay={i * 0.05} className={cn(p.featured && "sm:col-span-2 lg:col-span-1")}>
              <div
                className={cn(
                  "group flex h-full flex-col rounded-xl border p-5 ring-1 transition-all hover:-translate-y-1 hover:shadow-lg",
                  p.featured
                    ? "border-primary/40 bg-linear-to-br from-violet-500/10 via-card/60 to-primary/10 ring-primary/10 hover:shadow-primary/10"
                    : "border-border/70 bg-card/50 ring-foreground/5 hover:border-primary/30 hover:shadow-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-xl border",
                      p.featured
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-primary/25 bg-primary/10 text-primary"
                    )}
                  >
                    <Icon name={p.icon} className="size-5" />
                  </span>
                  {applied ? (
                    <Badge variant="secondary" className="gap-1.5 border-success/20 bg-success/10 text-success">
                      <Icon name="check" className="size-3" />
                      Application submitted
                    </Badge>
                  ) : p.status === "open" ? (
                    <Badge variant="secondary" className="gap-1.5 border-success/20 bg-success/10 text-success">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                      </span>
                      Applications open
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Coming soon
                    </Badge>
                  )}
                </div>

                <p className="mt-4 text-xs font-semibold text-primary">{p.tagline}</p>
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.description}</p>

                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <Icon name="check" className="mt-0.5 size-3 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-5">
                  {p.cta.href ? (
                    <Button
                      size="sm"
                      variant={p.featured ? "default" : "secondary"}
                      render={<Link href={applied ? "/programs/campus-ambassador/apply" : p.cta.href} />}
                    >
                      {applied ? "View application" : p.cta.label} <ArrowRight className="size-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" disabled>
                      {p.cta.label}
                    </Button>
                  )}
                </div>
              </div>
            </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}