import { DemoWorkflow } from "@/components/demo/demo-workflow";
import { Icon } from "@/components/shared/icon";
import { Badge } from "@/components/ui/badge";
import { howItWorksSteps, landingStats } from "@/lib/demo/marketing";

export default function HowItWorksPage() {
  return (
    <div className="space-y-10">
      <div className="text-center">
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          Interactive walkthrough
        </Badge>
        <h1 className="mx-auto mt-4 max-w-3xl font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          How Puvexa works
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Follow an 8-stage walkthrough as Puvexa diagnoses a sample bug, ranks verified fixes, checks the outcome, and
          rewards the knowledge. Everything below runs in your browser.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {landingStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/70 bg-card/60 px-3 py-3 text-center">
              <p className="font-heading text-lg font-bold tabular-nums text-foreground sm:text-xl">
                {s.value.toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <DemoWorkflow />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {howItWorksSteps.map((s, i) => (
          <div key={s.step} className="relative rounded-2xl border border-border/70 bg-card/50 p-4">
            <span className="absolute right-3 top-3 font-heading text-2xl font-bold text-muted-foreground/15">
              {s.step}
            </span>
            <span className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Icon name={s.icon} className="size-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">{s.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
            {i === 0 && <Badge className="absolute bottom-3 right-3 text-[9px]">start here →</Badge>}
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
        <p className="text-sm font-medium text-foreground">Ready to try it with your own problem?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Preview the whole product as a guest — no account, 3 free AI runs — or open the demo account to earn and claim
          FIX.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/login"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Continue as Guest
          </a>
          <a
            href="/rewards"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Explore rewards
          </a>
        </div>
      </div>
    </div>
  );
}