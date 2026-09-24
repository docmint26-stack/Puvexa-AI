import { DiagnoseWizard } from "@/components/diagnose/diagnose-wizard";

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
  q?: string | string[];
  cat?: string | string[];
  ctx?: string | string[];
};

export default async function DiagnosePage({ searchParams }: { searchParams: Promise<DiagnoseSearchParams> }) {
  const sp = await searchParams;
  const take = (v?: string | string[]) => (typeof v === "string" ? v : undefined);

  const q = take(sp.q);
  const cat = take(sp.cat);
  const ctx = take(sp.ctx);

  const defaults: WizardDefaults = {};
  if (q && q.trim().length >= 10) defaults.title = q.trim();
  if (ctx && ctx.trim().length >= 20) defaults.description = ctx.trim();
  if (cat && (CATEGORIES as readonly string[]).includes(cat)) defaults.category = cat as WizardDefaults["category"];

  return <DiagnoseWizard defaults={defaults} />;
}