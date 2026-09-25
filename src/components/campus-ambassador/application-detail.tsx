"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAmbassadorApplication } from "@/lib/campus-ambassador/local-application";
import type { StoredAmbassadorApplication } from "@/lib/campus-ambassador/types";

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value && value.trim() ? value : "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/50 p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function ApplicationDetailView() {
  const router = useRouter();
  const [application, setApplication] = React.useState<StoredAmbassadorApplication | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (!cancelled) setApplication(getAmbassadorApplication());
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  if (application === undefined) {
    return <div className="mx-auto h-48 max-w-2xl animate-pulse rounded-2xl border border-border/70 bg-card/40" />;
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-2xl font-semibold text-foreground">No application found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          There is no campus ambassador application saved on this device yet.
        </p>
        <Button className="mt-6" render={<Link href="/programs/campus-ambassador/apply" />}>
          Start your application <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  const submitted = new Date(application.submittedAt);
  const date = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(submitted);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(submitted);
  const d = application.details;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => router.push("/programs/campus-ambassador")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to program
      </button>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" />
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              My application
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved on this device for the Puvexa Campus Ambassador Program.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 border-success/20 bg-success/10 px-3 py-1 text-success">
          <CheckCircle2 className="size-3.5" /> Submitted
        </Badge>
      </div>

      <div className="mt-6 rounded-2xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Row label="Application ID" value={application.applicationId} />
          <Row label="Status" value="Submitted" />
          <Row label="Submitted" value={`${date} • ${time}`} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Section title="Personal Information">
          <Row label="Full name" value={application.fullName} />
          <Row label="Email" value={application.email} />
          <Row label="Phone" value={d.phone} />
          <Row label="Country" value={d.country} />
          <Row label="City" value={d.city} />
        </Section>

        <Section title="Academic Information">
          <Row label="Institution" value={d.institution} />
          <Row label="Degree / program" value={d.program} />
          <Row label="Expected graduation year" value={String(d.graduationYear)} />
          <Row label="Current student" value={d.currentStudent ? "Yes" : "No"} />
        </Section>

        <Section title="Community Experience">
          <Row label="Campus club / society" value={d.clubInvolvement} />
          <Row label="Leadership experience" value={d.leadershipExperience ? "Yes" : "No"} />
          {d.leadershipDescription ? <Row label="Leadership details" value={d.leadershipDescription} /> : null}
          <Row label="Previous ambassador" value={d.previousAmbassador ? "Yes" : "No"} />
          {d.previousAmbassadorDetails ? <Row label="Previous program" value={d.previousAmbassadorDetails} /> : null}
        </Section>

        <Section title="Motivation">
          <Row label="Why become a campus ambassador?" value={d.motivation} />
          <Row label="Impact you'd like to create" value={d.communityGoals} />
        </Section>

        <Section title="Reach & Activities">
          <Row label="GitHub" value={d.githubUrl} />
          <Row label="LinkedIn" value={d.linkedinUrl} />
          <Row label="Other profile" value={d.otherSocialUrl} />
          <Row label="Audience size" value={d.audienceCount != null ? String(d.audienceCount) : undefined} />
        </Section>

        <Section title="Skills">
          <Row label="Technical level" value={d.technicalLevel.charAt(0).toUpperCase() + d.technicalLevel.slice(1)} />
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Skills</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.skillTags.map((tag) => (
                <span key={tag} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Commitment & Support">
          <Row label="Weekly hours available" value={String(d.weeklyHours)} />
          <Row label="Availability (months)" value={String(d.availabilityMonths)} />
          <Row label="Time zone" value={d.timezone} />
          <Row label="Support needed" value={d.resourcesNeeded} />
        </Section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" render={<Link href="/dashboard" />}>
          Explore Puvexa <ArrowRight className="size-4" />
        </Button>
        <Button variant="ghost" render={<Link href="/" />}>
          <ChevronLeft className="size-4" /> Back to home
        </Button>
      </div>
    </div>
  );
}