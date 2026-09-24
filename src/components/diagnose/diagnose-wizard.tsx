"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Microscope, UploadCloud } from "lucide-react";
import { cn } from "cn";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnalyzingPanel } from "@/components/diagnose/analyzing-panel";
import { useDiagnosis } from "@/lib/hooks";
import { isDemoMode } from "@/lib/services";
import { notify } from "@/lib/feedback";
import { DiagnosisError } from "@/lib/api/diagnosis";
import type { CaseCategory, EvidenceKind } from "@/lib/demo/types";

const schema = z.object({
  title: z.string().trim().min(10, "Give a short, specific title (10+ characters)."),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters."),
  category: z.enum([
    "Coding Error",
    "Windows / OS",
    "Network & Wi-Fi",
    "Hardware & Devices",
    "Apps & Productivity",
    "Performance",
    "Security",
  ] as const),
  os: z.string().trim().min(1, "Select an operating system."),
  device: z.string().trim().min(1, "What device are you using?"),
  version: z.string().optional(),
  recentChange: z.string().optional(),
  software: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
type CategoryKey = FormValues["category"];

const EVIDENCE: { key: EvidenceKind; label: string }[] = [
  { key: "text", label: "Text summary" },
  { key: "log", label: "Log / output" },
  { key: "code", label: "Code snippet" },
  { key: "screenshot", label: "Screenshot" },
];

function WizardShell({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <PageHeader
        eyebrow="AI Diagnosis"
        title="Describe the problem"
        subtitle="Puvexa reads your description and evidence, then ranks the fixes most likely to work for your exact environment."
        action={
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Microscope className="size-3.5" /> {isDemoMode ? "Free in this demo" : "Verified fixes"}
          </div>
        }
      />
      {children}
      {footer}
    </div>
  );
}

export function DiagnoseWizard({ defaults }: { defaults?: Partial<FormValues> }) {
  const router = useRouter();
  const { startDiagnosis } = useDiagnosis();
  const [analyzing, setAnalyzing] = React.useState(false);
  const [stage, setStage] = React.useState({ name: "RECEIVED", progress: 0 });
  const [failure, setFailure] = React.useState<DiagnosisError | null>(null);
  const submitting = React.useRef(false);
  const [evidence, setEvidence] = React.useState<EvidenceKind[]>(["text"]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: "Coding Error",
      os: "Windows 11",
      device: "",
      version: "",
      recentChange: "",
      software: "",
      ...defaults,
    },
  });

  const values = useWatch({ control });
  const title = values.title ?? "";

  const toggleEvidence = (k: EvidenceKind) => {
    setEvidence((prev) => (prev.includes(k) ? prev.filter((e) => e !== k) : [...prev, k]));
  };

  const onSubmit = () => {
    if (evidence.length === 0) {
      setError("description", { message: "Select at least one evidence type." });
      return;
    }
    clearErrors("description");
    setAnalyzing(true);
  };

  const finishAnalysis = React.useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    const values = getValues();
    const input = {
      title: values.title,
      description: values.description,
      category: values.category as CaseCategory | "System",
      os: values.os,
      device: values.device,
      version: values.version ?? "",
      recentChange: values.recentChange ?? "",
      software: values.software || undefined,
      evidence,
    };
    try {
      const c = await startDiagnosis(input, {
        caseId: failure?.caseId,
        onStage: (name, progress) => setStage({ name, progress }),
      });
      router.replace(isDemoMode ? `/diagnose/${c.id}` : `/cases/${c.id}`);
    } catch (err) {
      if (err instanceof DiagnosisError) setFailure(err);
      notify.error(
        "Diagnosis not submitted",
        err instanceof Error ? err.message : "Could not run the diagnosis right now."
      );
      setAnalyzing(false);
    } finally {
      submitting.current = false;
    }
  }, [getValues, evidence, startDiagnosis, router, failure]);

  if (analyzing) {
    return (
      <WizardShell footer={<span />}>
        <AnimatePresence>
          <AnalyzingPanel title={title} onComplete={finishAnalysis} production={!isDemoMode} stage={stage.name} stageProgress={stage.progress} />
        </AnimatePresence>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      footer={
        <div className="mt-8 flex items-center justify-between border-t border-border/70 pt-4">
          <p className="text-xs text-muted-foreground">
            {evidence.length} evidence {evidence.length === 1 ? "type" : "types"} ·{" "}
            {isDemoMode ? "demo data stays local" : "submitted securely with your case"}
          </p>
          <Button type="submit" disabled={analyzing} onClick={handleSubmit(onSubmit)}>
            {isDemoMode ? "Run AI Diagnosis" : "Submit for Diagnosis"} <ArrowRight className="size-4" />
          </Button>
        </div>
      }
    >
      {failure && <div role="alert" className="mt-4 rounded-xl border border-destructive p-4">
        <p>{failure.message}</p>
        <Button onClick={() => setAnalyzing(true)}>Retry</Button>
        <Button variant="secondary" onClick={() => router.push(`/cases/${failure.caseId}`)}>Back to Case</Button>
      </div>}
      <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="d-title" className="text-sm font-medium text-foreground">
                Problem title
              </label>
              <Input
                id="d-title"
                placeholder="e.g. React hydration mismatch caused by client-only timestamp"
                {...register("title")}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="d-desc" className="text-sm font-medium text-foreground">
                What happens?
              </label>
              <Textarea
                id="d-desc"
                rows={6}
                placeholder="Describe symptoms, when it started, what changed, and anything you already tried…"
                {...register("description")}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Category</label>
                <Select value={values.category} onValueChange={(v) => setValue("category", v as CategoryKey)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Coding Error",
                      "Windows / OS",
                      "Network & Wi-Fi",
                      "Hardware & Devices",
                      "Apps & Productivity",
                      "Performance",
                      "Security",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Operating system</label>
                <Select value={values.os} onValueChange={(v) => setValue("os", v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="OS" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Windows 11", "Windows 10", "macOS", "Linux", "iOS", "Android"].map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="d-device" className="text-sm font-medium text-foreground">
                  Device / model
                </label>
                <Input id="d-device" placeholder="e.g. Dell XPS 15" {...register("device")} />
                {errors.device && <p className="text-xs text-destructive">{errors.device.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="d-ver" className="text-sm font-medium text-foreground">
                  Version (optional)
                </label>
                <Input id="d-ver" placeholder="e.g. Next.js 15 · Python 3.12" {...register("version")} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="d-change" className="text-sm font-medium text-foreground">
                Recent change (optional)
              </label>
              <Input
                id="d-change"
                placeholder="e.g. Updated the driver via Windows Update yesterday"
                {...register("recentChange")}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="size-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Evidence to attach</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick what you can provide. More evidence = sharper signature matching.
              </p>
              <div className="mt-3 space-y-2">
                {EVIDENCE.map((e) => {
                  const active = evidence.includes(e.key);
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => toggleEvidence(e.key)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                        active
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {e.label}
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded-full border",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}
                      >
                        {active && <Check className="size-2.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {isDemoMode
                  ? "Demo mode: evidence is simulated locally — nothing is uploaded."
                  : "Production: evidence is recorded with your case and stays private to your account."}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What you&apos;ll get
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li className="flex gap-2"><Check className="mt-0.5 size-3 text-success" /> Ranked fixes with real success rates</li>
                <li className="flex gap-2"><Check className="mt-0.5 size-3 text-success" /> A guided step-by-step try-fix checklist</li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3 text-success" />
                  {isDemoMode ? "Workshop +8 FIX when your outcome verifies" : "FIX rewards for verified outcomes"}
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </form>
    </WizardShell>
  );
}
