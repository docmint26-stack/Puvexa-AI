"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EASE_OUT_EXPO } from "@/lib/motion";
import {
  AMBASSADOR_TECHNICAL_LEVELS,
  AMBASSADOR_SKILL_TAGS,
  type AmbassadorTechnicalLevel,
} from "@/lib/campus-ambassador/types";
import {
  clearApplicationDraft,
  readApplicationDraft,
  saveApplicationDraft,
} from "@/lib/campus-ambassador/storage";
import { AmbassadorLocalSaveError } from "@/lib/campus-ambassador/local-application";
import { ambassadorService } from "@/lib/services";
import type { AmbassadorApplicationPayload, StoredAmbassadorApplication } from "@/lib/campus-ambassador/types";
import { ApplicationThankYou } from "./application-thank-you";

const CURRENT_YEAR = new Date().getFullYear();

const optionalUrl = (message: string) =>
  z.string().trim().refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), message).optional();

const schema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name (3+ characters)."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().optional(),
  country: z.string().trim().min(2, "Enter your country."),
  city: z.string().trim().optional(),

  institution: z.string().trim().min(2, "Enter your institution."),
  program: z.string().trim().min(2, "Enter your degree or program."),
  graduationYear: z.number().int().min(CURRENT_YEAR).max(CURRENT_YEAR + 12),
  currentStudent: z.boolean(),
  clubMember: z.boolean(),
  clubInvolvement: z.string().trim().optional(),

  leadershipExperience: z.boolean(),
  leadershipDescription: z.string().trim().optional(),
  motivation: z.string().trim().min(40, "Give at least 40 characters so we can understand your motivation."),
  communityGoals: z.string().trim().min(40, "Give at least 40 characters describing what you want to achieve."),

  githubUrl: optionalUrl("Enter a valid URL (https://…)."),
  linkedinUrl: optionalUrl("Enter a valid URL (https://…)."),
  otherSocialUrl: optionalUrl("Enter a valid URL (https://…)."),
  audienceCount: z
    .custom<number | undefined>(
      (v) =>
        v === undefined ||
        (typeof v === "number" &&
          (Number.isNaN(v) || (Number.isInteger(v) && v >= 0))),
      "Enter a valid number."
    ),

  technicalLevel: z.enum(AMBASSADOR_TECHNICAL_LEVELS),
  skillTags: z.array(z.string()).min(1, "Select at least one skill."),

  weeklyHours: z.number().int().min(1, "At least 1 hour per week.").max(40, "Max 40 hours per week."),
  availabilityMonths: z.number().int().min(1, "At least 1 month.").max(24, "Max 24 months."),
  timezone: z.string().trim().min(1, "Select a time zone."),
  resourcesNeeded: z.string().trim().min(10, "Tell us what support you need (10+ characters)."),

  previousAmbassador: z.boolean(),
  previousAmbassadorDetails: z.string().trim().optional(),
  consent: z.boolean().refine((v) => v, "Please agree so we can process your application."),
});

type FormValues = z.infer<typeof schema>;

interface StepDef {
  id: string;
  title: string;
  description: string;
  fields: (keyof FormValues)[];
}

const STEPS: StepDef[] = [
  {
    id: "personal",
    title: "Personal details",
    description: "How we can reach you and where you're based.",
    fields: ["fullName", "email", "phone", "country", "city"],
  },
  {
    id: "academic",
    title: "Academic details",
    description: "Where you study and what you're working toward.",
    fields: ["institution", "program", "graduationYear", "currentStudent", "clubMember", "clubInvolvement"],
  },
  {
    id: "community",
    title: "Community & leadership",
    description: "Your experience helping people and leading groups.",
    fields: ["leadershipExperience", "leadershipDescription", "motivation", "communityGoals"],
  },
  {
    id: "reach",
    title: "Your reach",
    description: "Profiles and audience you bring to the table (optional).",
    fields: ["githubUrl", "linkedinUrl", "otherSocialUrl", "audienceCount"],
  },
  {
    id: "skills",
    title: "Skills",
    description: "Your technical level and what you love to work on.",
    fields: ["technicalLevel", "skillTags"],
  },
  {
    id: "availability",
    title: "Motivation & availability",
    description: "Time commitment and how we can work together.",
    fields: ["weeklyHours", "availabilityMonths", "timezone", "resourcesNeeded"],
  },
  {
    id: "final",
    title: "Review & submit",
    description: "Last confirmations before we receive your application.",
    fields: ["previousAmbassador", "previousAmbassadorDetails", "consent"],
  },
];

const TIMEZONES = [
  "UTC",
  "GMT — London",
  "CET — Berlin / Paris",
  "EET — Athens / Cairo",
  "IST — New Delhi",
  "GMT+4 — Dubai",
  "GST — Riyadh",
  "WAT — Lagos",
  "SAST — Johannesburg",
  "CST — Beijing",
  "JST — Tokyo",
  "KST — Seoul",
  "AEST — Sydney",
  "NZST — Auckland",
  "ET — New York",
  "CT — Chicago",
  "MT — Denver",
  "PT — Los Angeles",
  "ART — Buenos Aires",
  "BRT — São Paulo",
];

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs text-foreground">
          {label} {required ? <span className="text-destructive">*</span> : null}
        </Label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CheckRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors text-xs",
        checked
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}









const MASK =
  "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]";

export function AmbassadorApplicationForm() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [application, setApplication] = React.useState<StoredAmbassadorApplication | null>(null);
  const draftApplied = React.useRef(false);

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    reset,
    getValues,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentStudent: true,
      clubMember: false,
      leadershipExperience: false,
      previousAmbassador: false,
      skillTags: [],
      consent: false,
      graduationYear: CURRENT_YEAR,
      audienceCount: undefined,
      weeklyHours: 5,
      availabilityMonths: 6,
      timezone: "",
      technicalLevel: "intermediate",
    },
  });

  const values = useWatch({ control });
  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  React.useEffect(() => {
    const draft = readApplicationDraft<Partial<FormValues>>();
    if (draft) {
      reset({ ...getValues(), ...draft, consent: false });
    }
    draftApplied.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!draftApplied.current) return;
    const id = window.setTimeout(() => {
      saveApplicationDraft({
        ...getValues(),
        consent: false,
        previousAmbassadorDetails: getValues("previousAmbassadorDetails"),
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [values, getValues]);

  const goNext = async () => {
    const fields = currentStep.fields;
    const ok = await trigger(fields, { shouldFocus: true });
    if (ok) {
      setSubmitError(null);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const goBack = () => {
    setSubmitError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = async (formValues: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: AmbassadorApplicationPayload = {
        fullName: formValues.fullName,
        email: formValues.email,
        phone: formValues.phone || undefined,
        country: formValues.country,
        city: formValues.city || undefined,
        institution: formValues.institution,
        program: formValues.program,
        graduationYear: formValues.graduationYear,
        currentStudent: formValues.currentStudent,
        clubInvolvement: formValues.clubMember ? formValues.clubInvolvement || undefined : undefined,
        leadershipExperience: formValues.leadershipExperience,
        leadershipDescription: formValues.leadershipDescription || undefined,
        motivation: formValues.motivation,
        communityGoals: formValues.communityGoals,
        githubUrl: formValues.githubUrl || undefined,
        linkedinUrl: formValues.linkedinUrl || undefined,
        otherSocialUrl: formValues.otherSocialUrl || undefined,
        audienceCount: formValues.audienceCount || undefined,
        technicalLevel: formValues.technicalLevel as AmbassadorTechnicalLevel,
        skillTags: formValues.skillTags,
        weeklyHours: formValues.weeklyHours,
        availabilityMonths: formValues.availabilityMonths,
        timezone: formValues.timezone,
        resourcesNeeded: formValues.resourcesNeeded,
        previousAmbassador: formValues.previousAmbassador,
        previousAmbassadorDetails: formValues.previousAmbassadorDetails || undefined,
        consent: formValues.consent,
      };
      const record = await ambassadorService.submitApplication(payload);
      // Already cleaned up inside the local service; keep the device tidy.
      clearApplicationDraft();
      setApplication(record as StoredAmbassadorApplication);
    } catch (err) {
      if (err instanceof AmbassadorLocalSaveError) {
        // The device refused to persist the application (private mode, quota).
        setSubmitError(err.message);
      } else if (err instanceof Error) {
        // Duplicate-already-applied is handled before the form renders; treat any
        // other failure as a local-only hiccup. Never surface backend/API errors.
        setSubmitError(
          err.message.includes("already submitted")
            ? err.message
            : "We couldn't save your application on this device. Please try again."
        );
      } else {
        setSubmitError("We couldn't save your application on this device. Please try again.");
      }
      setSubmitting(false);
    }
  };

  if (application) {
    return <ApplicationThankYou application={application} />;
  }

  const toggleTag = (tag: string) => {
    const current = getValues("skillTags") ?? [];
    setValue(
      "skillTags",
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      { shouldValidate: true, shouldDirty: true }
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/programs/campus-ambassador")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to program
        </button>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {step + 1} / {STEPS.length}
        </span>
      </div>

      <div aria-hidden="true" className="mb-6 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div aria-live="polite">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {currentStep.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{currentStep.description}</p>
      </div>

      {submitError && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className="space-y-5"
          >
            {step === 0 && (
              <>
                <Field label="Full name" htmlFor="ca-name" required error={errors.fullName?.message}>
                  <Input id="ca-name" placeholder="e.g. Ada Lovelace" {...register("fullName")} />
                </Field>
                <Field label="Email" htmlFor="ca-email" required error={errors.email?.message}>
                  <Input id="ca-email" type="email" placeholder="you@university.edu" {...register("email")} />
                </Field>
                <Field label="Phone (optional)" htmlFor="ca-phone" error={errors.phone?.message}>
                  <Input id="ca-phone" placeholder="+1 555 000 1234" {...register("phone")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Country" htmlFor="ca-country" required error={errors.country?.message}>
                    <Input id="ca-country" placeholder="e.g. Nigeria" {...register("country")} />
                  </Field>
                  <Field label="City (optional)" htmlFor="ca-city" error={errors.city?.message}>
                    <Input id="ca-city" placeholder="e.g. Lagos" {...register("city")} />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Institution" htmlFor="ca-inst" required error={errors.institution?.message}>
                  <Input id="ca-inst" placeholder="e.g. University of Lagos" {...register("institution")} />
                </Field>
                <Field label="Degree / program" htmlFor="ca-program" required error={errors.program?.message}>
                  <Input id="ca-program" placeholder="e.g. BSc Computer Science" {...register("program")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Expected graduation year" htmlFor="ca-grad" required error={errors.graduationYear?.message}>
                    <Input id="ca-grad" type="number" min={CURRENT_YEAR} max={CURRENT_YEAR + 12} {...register("graduationYear", { valueAsNumber: true })} />
                  </Field>
                  <Field label="Current student?" required>
                    <div className="grid grid-cols-2 gap-2">
                      <CheckRow label="Yes, enrolled now" checked={values.currentStudent === true} onChange={() => setValue("currentStudent", true, { shouldValidate: true })} />
                      <CheckRow label="Not currently" checked={values.currentStudent === false} onChange={() => setValue("currentStudent", false, { shouldValidate: true })} />
                    </div>
                  </Field>
                </div>
                <Field label="Campus / club involvement?">
                  <CheckRow
                    label="I'm part of a campus club or society"
                    hint="Enable this to tell us which one (optional)."
                    checked={values.clubMember === true}
                    onChange={() => setValue("clubMember", !values.clubMember, { shouldValidate: true })}
                  />
                </Field>
                {values.clubMember && (
                  <Field label="Which club or society?" htmlFor="ca-club" error={errors.clubInvolvement?.message}>
                    <Input id="ca-club" placeholder="e.g. Google Developer Student Club, engineering society…" {...register("clubInvolvement")} />
                  </Field>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Leadership experience?">
                  <CheckRow
                    label="I've led a team, event, or project before"
                    hint="Enable this to describe it (optional)."
                    checked={values.leadershipExperience === true}
                    onChange={() => setValue("leadershipExperience", !values.leadershipExperience, { shouldValidate: true })}
                  />
                </Field>
                {values.leadershipExperience && (
                  <Field label="Tell us about it" htmlFor="ca-lead" error={errors.leadershipDescription?.message}>
                    <Textarea id="ca-lead" rows={3} placeholder="e.g. Organized a 120-person hackathon in 2025…" {...register("leadershipDescription")} />
                  </Field>
                )}
                <Field
                  label="Why do you want to become a campus ambassador?"
                  htmlFor="ca-motivation"
                  required
                  hint={`${(values.motivation ?? "").trim().length} chars`}
                  error={errors.motivation?.message}
                >
                  <Textarea id="ca-motivation" rows={4} placeholder="Share what drives you and what you hope to gain…" {...register("motivation")} />
                </Field>
                <Field
                  label="What would you change about tech problem-solving on your campus?"
                  htmlFor="ca-goals"
                  required
                  hint={`${(values.communityGoals ?? "").trim().length} chars`}
                  error={errors.communityGoals?.message}
                >
                  <Textarea id="ca-goals" rows={4} placeholder="Describe the impact you'd like to create…" {...register("communityGoals")} />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-xl border border-border/70 bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
                  These are optional. Anything you share helps us understand the community you can reach.
                </div>
                <Field label="GitHub (optional)" htmlFor="ca-gh" error={errors.githubUrl?.message}>
                  <Input id="ca-gh" placeholder="https://github.com/you" {...register("githubUrl")} />
                </Field>
                <Field label="LinkedIn (optional)" htmlFor="ca-li" error={errors.linkedinUrl?.message}>
                  <Input id="ca-li" placeholder="https://linkedin.com/in/you" {...register("linkedinUrl")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Other profile (optional)" htmlFor="ca-social" error={errors.otherSocialUrl?.message}>
                    <Input id="ca-social" placeholder="https://tiktok.com/@you" {...register("otherSocialUrl")} />
                  </Field>
                  <Field label="Audience size (optional)" htmlFor="ca-aud" error={errors.audienceCount?.message}>
                    <Input id="ca-aud" type="number" min={0} placeholder="e.g. 500" {...register("audienceCount", { valueAsNumber: true })} />
                  </Field>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Technical level" required error={errors.technicalLevel?.message}>
                  <Select
                    value={values.technicalLevel ?? "intermediate"}
                    onValueChange={(v) => setValue("technicalLevel", (v ?? "intermediate") as AmbassadorTechnicalLevel, { shouldValidate: true })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a level" />
                    </SelectTrigger>
                    <SelectContent>
                      {AMBASSADOR_TECHNICAL_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Select your skills" required error={errors.skillTags?.message}>
                  <div className="flex flex-wrap gap-2">
                    {AMBASSADOR_SKILL_TAGS.map((tag) => {
                      const active = getValues("skillTags")?.includes(tag) ?? false;
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </>
            )}

            {step === 5 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Weekly hours you can commit" htmlFor="ca-hours" required error={errors.weeklyHours?.message}>
                    <Input id="ca-hours" type="number" min={1} max={40} {...register("weeklyHours", { valueAsNumber: true })} />
                  </Field>
                  <Field label="Availability (months)" htmlFor="ca-months" required error={errors.availabilityMonths?.message}>
                    <Input id="ca-months" type="number" min={1} max={24} {...register("availabilityMonths", { valueAsNumber: true })} />
                  </Field>
                </div>
                <Field label="Time zone" required error={errors.timezone?.message}>
                  <Select
                    value={values.timezone || undefined}
                    onValueChange={(v) => setValue("timezone", v ?? "", { shouldValidate: true })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="What support would help you succeed?"
                  htmlFor="ca-resources"
                  required
                  hint={`${(values.resourcesNeeded ?? "").trim().length} chars`}
                  error={errors.resourcesNeeded?.message}
                >
                  <Textarea id="ca-resources" rows={3} placeholder="e.g. Starter kit, event templates, office hours with the team…" {...register("resourcesNeeded")} />
                </Field>
              </>
            )}

            {step === 6 && (
              <>
                <Field label="Have you been a campus ambassador before?">
                  <CheckRow
                    label="Yes — I've been an ambassador for another program"
                    checked={values.previousAmbassador === true}
                    onChange={() => setValue("previousAmbassador", !values.previousAmbassador, { shouldValidate: true })}
                  />
                </Field>
                {values.previousAmbassador && (
                  <Field label="Which program and when?" htmlFor="ca-prev" error={errors.previousAmbassadorDetails?.message}>
                    <Input id="ca-prev" placeholder="e.g. GitHub Campus Expert (2024–2025)" {...register("previousAmbassadorDetails")} />
                  </Field>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "You're a student or recent graduate", done: true },
                    { label: "You understand it's a volunteer leadership role", done: true },
                    { label: "3–5 hours / month is realistic for you", done: (values.weeklyHours ?? 0) >= 3 },
                    { label: "Email is the right contact channel", done: /@/.test(values.email ?? "") },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2 rounded-lg border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                      <Check className={cn("mt-0.5 size-3.5 shrink-0", item.done ? "text-success" : "text-muted-foreground/50")} />
                      {item.label}
                    </div>
                  ))}
                </div>
                <Field label="Terms & consent" required error={errors.consent?.message}>
                  <CheckRow
                    label="I agree to the program terms and consent to Puvexa processing this application"
                    hint="We only use this data to evaluate your application and stay in touch about the program."
                    checked={values.consent === true}
                    onChange={() => setValue("consent", !values.consent, { shouldValidate: true })}
                  />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className={cn("flex items-center justify-between border-t border-border/70 pt-5", MASK)}>
          <Button type="button" variant="ghost" disabled={step === 0 || submitting} onClick={goBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {isLast ? (
            <Button type="submit" disabled={submitting} className="min-w-44">
              {submitting ? (
                <><Loader2 className="size-4 animate-spin" /> Submitting application...</>
              ) : (
                <><ShieldCheck className="size-4" /> Submit application</>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={goNext}>
              Continue <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}