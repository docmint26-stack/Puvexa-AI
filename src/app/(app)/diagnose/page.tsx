import { DiagnoseWizard } from "@/components/diagnose/diagnose-wizard";
import {
  diagnosisContext,
  filterToDiagnosisCategory,
  getProblemById,
} from "@/lib/data";

type WizardDefaults = NonNullable<Parameters<typeof DiagnoseWizard>[0]["defaults"]>;

const CATEGORIES: WizardDefaults["category"][] = [
  "Coding Error",
  "Windows / OS",
  "Network & Wi-Fi",
  "Hardware & Devices",
  "Apps & Productivity",
  "Performance",
  "Security",
];

type DiagnoseSearchParams = {
  p?: string | string[];
  q?: string | string[];
  cat?: string | string[];
  ctx?: string | string[];
};

export default async function DiagnosePage({ searchParams }: { searchParams: Promise<DiagnoseSearchParams> }) {
  const sp = await searchParams;
  const take = (v?: string | string[]) => (typeof v === "string" ? v : undefined);

  const p = take(sp.p);
  const q = take(sp.q);
  const cat = take(sp.cat);
  const ctx = take(sp.ctx);

  const defaults: WizardDefaults = {};
  let selectedProblem: { id: string; title: string } | undefined;

  const problem = p ? getProblemById(p) : undefined;
  if (problem) {
    // Canonical record wins: exact title, category, and structured context.
    defaults.title = problem.title;
    defaults.description = diagnosisContext(problem);
    defaults.category = filterToDiagnosisCategory(problem.filter);
    selectedProblem = { id: problem.id, title: problem.title };
  } else {
    if (q && q.trim().length >= 10) defaults.title = q.trim();
    if (ctx && ctx.trim().length >= 20) defaults.description = ctx.trim();
    if (cat && (CATEGORIES as readonly string[]).includes(cat)) defaults.category = cat as WizardDefaults["category"];
  }

  return <DiagnoseWizard defaults={defaults} selectedProblem={selectedProblem} />;
}
