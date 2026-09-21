import { RECOMMENDATIONS, type Recommendation } from "@/components/diagnose/live-diagnosis-panel";

export type AiToolId =
  | "analyze-problem"
  | "analyze-screenshot"
  | "analyze-logs"
  | "diagnose-code"
  | "rank-fixes"
  | "verify-outcome"
  | "generate-summary";

export type AiFileKind = "log" | "image" | "code" | "text";

export interface AiFile {
  id: string;
  name: string;
  size: number;
  kind: AiFileKind;
  url?: string;
  progress: number;
  status: "uploading" | "ready";
}

export interface AiRunInput {
  title: string;
  description: string;
  category: string;
  environment: string;
  tags: string;
  files: AiFile[];
  extra?: string;
}

export interface SimilarCase {
  title: string;
  matched: string;
  confidence: number;
}

export interface AiOutput {
  tool: AiToolId;
  issue: string;
  rootCause: string;
  fixes: Recommendation[];
  similar: SimilarCase[];
  confidence: number;
  signals: string[];
  provenance: string[];
  note: string;
  generatedAt: string;
}

export interface AiTextOutput {
  tab: AiCreationTabId;
  title: string;
  label: string;
  body: string;
  provenance: string[];
}

export const FILE_KIND_META: Record<AiFileKind, { label: string; icon: string; tone: string }> = {
  log: { label: "Log", icon: "file-text", tone: "text-amber-300" },
  image: { label: "Image", icon: "image", tone: "text-violet-300" },
  code: { label: "Code", icon: "braces", tone: "text-cyan-300" },
  text: { label: "Text", icon: "file", tone: "text-muted-foreground" },
};

export const CATEGORIES = [
  "Network & Internet",
  "System / OS",
  "Hardware & Drivers",
  "Development",
  "Installation / Update",
  "Other",
];

export const ENVIRONMENTS = [
  "Windows 11",
  "Windows 10",
  "macOS",
  "Linux",
  "Next.js",
  "Node.js",
  "Docker",
  "Android",
  "Other",
];

export const DEMO_FILES: { name: string; size: number; kind: AiFileKind }[] = [
  { name: "wlan_power_issue_log.txt", size: 18_624, kind: "log" },
  { name: "screenshot_error_01.png", size: 319_488, kind: "image" },
  { name: "build_failure_trace.txt", size: 9_625, kind: "log" },
  { name: "nextjs_hydration_bug.png", size: 198_656, kind: "image" },
  { name: "system_event.log", size: 12_288, kind: "log" },
  { name: "appconfig.dev.ts", size: 2_048, kind: "code" },
];

export const ACTION_META: { id: AiToolId; label: string; icon: string; hint: string }[] = [
  { id: "analyze-problem", label: "Analyze Problem", icon: "scan-search", hint: "Match a written problem to verified cases" },
  { id: "analyze-screenshot", label: "Analyze Screenshot", icon: "image", hint: "Read an error screenshot" },
  { id: "analyze-logs", label: "Analyze Logs", icon: "file-text", hint: "Extract signatures from log files" },
  { id: "diagnose-code", label: "Diagnose Code", icon: "braces", hint: "Explain a code or build failure" },
  { id: "rank-fixes", label: "Rank Fixes", icon: "list-ordered", hint: "Order fixes by success rate" },
  { id: "verify-outcome", label: "Verify Outcome", icon: "badge-check", hint: "Validate against the fix graph" },
  { id: "generate-summary", label: "Generate Summary", icon: "file-output", hint: "Produce a shareable summary" },
];

const ROOT_WIFI = "Aggressive battery power-saving policy suspends the WLAN adapter, dropping the connection once throughput pauses.";
const FIXES_WIFI = RECOMMENDATIONS.slice(0, 4);
const SIMILAR_WIFI: SimilarCase[] = [
  { title: "Wi-Fi drops on battery — 5 GHz band", matched: "3 signatures matched", confidence: 94 },
  { title: "Network flap after Windows update", matched: "2 signatures matched", confidence: 87 },
  { title: "WLAN adapter scheduled off at 42 ms", matched: "1 signature matched", confidence: 71 },
];

const SIMILAR_DEV: SimilarCase[] = [
  { title: "Next.js hydration mismatch on index", matched: "2 signatures matched", confidence: 91 },
  { title: "Tailwind v4 class missing in build", matched: "2 signatures matched", confidence: 84 },
  { title: "curl: (60) SSL cert verify failed", matched: "1 signature matched", confidence: 66 },
];

export interface AiTabMeta {
  id: AiCreationTabId;
  label: string;
  icon: string;
  prompt: string;
  placeholder: string;
}

export type AiCreationTabId =
  | "diagnose"
  | "summarize"
  | "explain-error"
  | "rewrite-logs"
  | "create-report"
  | "generate-fix-plan";

export const AI_TABS: AiTabMeta[] = [
  { id: "diagnose", label: "Diagnose", icon: "stethoscope", prompt: "Paste the error or paste a problem description for a full diagnosis.", placeholder: "e.g. VPN stops working after sleep on Windows 11…" },
  { id: "summarize", label: "Summarize", icon: "align-left", prompt: "Turn a long issue into a concise, shareable summary.", placeholder: "Paste the issue context, log excerpt or error text…" },
  { id: "explain-error", label: "Explain Error", icon: "circle-help", prompt: "Explain what this error means and what the real cause is.", placeholder: "Paste a stack trace, build error or exception…" },
  { id: "rewrite-logs", label: "Rewrite Logs", icon: "file-sparkles", prompt: "Clean a raw log excerpt into a readable, annotated timeline.", placeholder: "Paste raw log lines…" },
  { id: "create-report", label: "Create Report", icon: "notebook-pen", prompt: "Generate a structured markdown report ready to share.", placeholder: "Describe the issue so a report can be drafted…" },
  { id: "generate-fix-plan", label: "Generate Fix Plan", icon: "list-checks", prompt: "Produce a step-by-step fix plan with expected success rates.", placeholder: "Describe the problem you want fixed…" },
];

function now() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function provenance(files: AiFile[], extra?: string): string[] {
  const fileNames = files.map((f) => f.name);
  const list = [...fileNames];
  if (extra) list.push(extra);
  if (list.length === 0) list.push("context: typed input");
  return list;
}

export function buildOutput(tool: AiToolId, input: AiRunInput): AiOutput {
  const f = provenance(input.files, input.extra);
  switch (tool) {
    case "analyze-problem": {
      const wifi = input.category === "Network & Internet" || !input.category;
      return {
        tool,
        issue: wifi ? "Wi-Fi disconnects every few minutes on battery power" : `${input.title || "Issue"} — needs a closer look`,
        rootCause: wifi ? ROOT_WIFI : "The reported inputs do not map to a single verified root cause yet; ranked fixes use the closest matched signatures.",
        fixes: wifi ? FIXES_WIFI : RECOMMENDATIONS.slice(0, 4),
        similar: wifi ? SIMILAR_WIFI : SIMILAR_DEV,
        confidence: wifi ? 86 : 62,
        signals: ["PWR_ON_BATTERY", "WLAN_RESET_COUNT>6", "EVENT_5005"],
        provenance: f,
        note: "Top recommendations are weighted by verified fix graphs from the Puvexa community.",
        generatedAt: now(),
      };
    }
    case "analyze-screenshot": {
      return {
        tool,
        issue: "Network icon shows \"No internet\" while Wi-Fi is listed as connected",
        rootCause: "The adapter holds an association but loses the default route — typically a DHCP lease renewal failure after idle.",
        fixes: [RECOMMENDATIONS[2], RECOMMENDATIONS[6], RECOMMENDATIONS[3], RECOMMENDATIONS[1]],
        similar: SIMILAR_WIFI,
        confidence: 78,
        signals: ["ROUTE_MISSING", "DHCP_RENEW_FAIL", "NO_INTERNET"],
        provenance: f,
        note: "Visual analysis inferred adapter association + missing route.",
        generatedAt: now(),
      };
    }
    case "analyze-logs": {
      return {
        tool,
        issue: "WLAN adapter powers down during idle and fails to reconnect",
        rootCause: "Power management is suspending the adapter (\"allow the computer to turn off this device\"), interrupting the connection mid-session.",
        fixes: [RECOMMENDATIONS[0], RECOMMENDATIONS[1], RECOMMENDATIONS[3], RECOMMENDATIONS[12]],
        similar: SIMILAR_WIFI,
        confidence: 90,
        signals: ["WLAN_POWER_OFF", "NDIS_RESET", "TIMEOUT_12s"],
        provenance: f,
        note: "21 events scanned · 3 signature groups matched.",
        generatedAt: now(),
      };
    }
    case "diagnose-code": {
      return {
        tool,
        issue: "Next.js hydration mismatch on the landing hero section",
        rootCause: "Client renders setTimeout-updated content while the server render is static — hydration compares two different trees.",
        fixes: [
          { id: "dev-1", rank: 1, title: "Suppress rendering until mounted", successRate: 93, cases: 214, minutes: "5 min", badges: ["Verified", "Top pick"], tone: "primary" },
          { id: "dev-2", rank: 2, title: "Move the timer into a client effect", successRate: 88, cases: 179, minutes: "7 min", badges: ["High confidence"], tone: "muted" },
          { id: "dev-3", rank: 3, title: "Match locale/time on server and client", successRate: 84, cases: 96, minutes: "6 min", badges: ["Common fix"], tone: "muted" },
          { id: "dev-4", rank: 4, title: "Pin an explicit text content baseline", successRate: 79, cases: 121, minutes: "4 min", badges: ["Low risk"], tone: "muted" },
        ],
        similar: SIMILAR_DEV,
        confidence: 88,
        signals: ["HYDRATION_MISMATCH", "TEXT_CONTENT", "CELL_TAG"],
        provenance: f,
        note: "Static analysis of the hydration error payload.",
        generatedAt: now(),
      };
    }
    case "rank-fixes": {
      return {
        tool,
        issue: "Fix ordering for the disconnected-Wi-Fi pattern",
        rootCause: "Fixes sorted by verified success rate across 2,140 community cases.",
        fixes: RECOMMENDATIONS.slice(0, 6),
        similar: SIMILAR_WIFI,
        confidence: 91,
        signals: ["PWR_ON_BATTERY", "WLAN_RESET_COUNT>6"],
        provenance: f,
        note: "Ranking uses success rate, case volume and recency.",
        generatedAt: now(),
      };
    }
    case "verify-outcome": {
      return {
        tool,
        issue: "Outcome \"Wi-Fi stable on battery\" verified against the fix graph",
        rootCause: "\"Disable Wi-Fi power-saving on battery\" has 92% verified success — this case overlaps the matched signature.",
        fixes: [RECOMMENDATIONS[0]],
        similar: SIMILAR_WIFI,
        confidence: 74,
        signals: ["FIX_APPLIED_r1", "OBS_WINDOW_24h", "NO_RESET_24h"],
        provenance: f,
        note: "A 24h observation window is required before rewards unlock.",
        generatedAt: now(),
      };
    }
    case "generate-summary": {
      return {
        tool,
        issue: "Wi-Fi drops on battery — summarized for sharing",
        rootCause: "Power-saving suspends the WLAN adapter; fix by disabling adapter power-saving or updating the driver.",
        fixes: [RECOMMENDATIONS[0], RECOMMENDATIONS[1]],
        similar: SIMILAR_WIFI,
        confidence: 82,
        signals: ["PWR_ON_BATTERY", "WLAN_RESET"],
        provenance: f,
        note: "Summary can be pasted into a case, issue or PR description.",
        generatedAt: now(),
      };
    }
  }
}

export function buildTextOutput(tab: AiCreationTabId, input: string, files: AiFile[], extra?: string): AiTextOutput {
  const f = provenance(files, extra);
  const subject = input.trim() || extra || "the reported issue";
  switch (tab) {
    case "diagnose":
      return {
        tab,
        title: "Diagnosis",
        label: "Structured diagnosis",
        body: `Detected issue: Wi-Fi adapter power management conflict\n\nLikely root cause: aggressive battery-saving policy disables WLAN performance once throughput is idle.\n\nMatched verified signatures: 3\nConfidence: High (86%)\n\nRecommended next step: disable Wi-Fi power-saving on battery, then update the WLAN driver.`,
        provenance: f,
      };
    case "summarize":
      return {
        tab,
        title: "Summary",
        label: "1-minute summary",
        body: `Summary — ${subject}\n\nWi-Fi silently drops a few minutes after the laptop goes on battery. The adapter is still "connected", but packets stop. Root cause points to WLAN power management. Two verified fixes fix 9 of 10 cases: disabling adapter power-saving, then updating the driver.`,
        provenance: f,
      };
    case "explain-error":
      return {
        tab,
        title: "Error explained",
        label: "Plain-language explanation",
        body: `The stack trace is a WLAN reset: the OS suspended the adapter (event 5005), then the driver re-negotiated the pair (NDIS reset). That long pause is the "no internet" you saw. It is not a router or ISP fault — the device loses its association on battery.\n\nPractical fix: uncheck "Allow the computer to turn off this device" for the Wi-Fi adapter in Device Manager.`,
        provenance: f,
      };
    case "rewrite-logs":
      return {
        tab,
        title: "Rewritten logs",
        label: "Annotated timeline",
        body: `[t=0.000] WLAN up · associated, battery 100%\n[t=2.10] entered idle — throughput 0\n[t=2.11] power-mgmt: suspend adapter (allow-turned-off=1)\n[t=2.12] NDIS reset → link down\n[t=4.30] user resumes; reconnect initiated\n[t=4.42] DHCP renew failed once, retried\n[t=5.10] link restored — root cause: adapter power-off, not router`,
        provenance: f,
      };
    case "create-report":
      return {
        tab,
        title: "Report draft",
        label: "Markdown · ready to share",
        body: `# Diagnose Report — Wi-Fi drops on battery\n\n**Environment:** Windows 11 · onboard WLAN · battery profile\n**Severity:** Medium · affects all sessions\n\n## Summary\nWi-Fi disconnects ~3 min after going on battery. Adapter stays "connected" but stops forwarding traffic.\n\n## Root cause\nPower management suspends the WLAN adapter during idle.\n\n## Recommended fixes\n1. Disable Wi-Fi power-saving on battery (92% success, 4 min)\n2. Update the WLAN driver (88% success, 8 min)\n3. Reset TCP/IP & renew DHCP (84% success, 6 min)\n\n## Verification\nMatched 3 verified signatures from the Puvexa fix graph. Confidence: High.`,
        provenance: f,
      };
    case "generate-fix-plan":
      return {
        tab,
        title: "Fix plan",
        label: "Step-by-step",
        body: `Fix plan — ${subject}\n\nStep 1 · Disable adapter power-saving (4 min, 92% expected)\n  Device Manager → Network adapters → Wi-Fi → Power Management → uncheck "Allow the computer to turn off this device".\n\nStep 2 · Update the WLAN driver (8 min, +88% when step 1 insufficient)\n  Settings → Windows Update → Optional updates → driver.\n\nStep 3 · Reset TCP/IP if still flaky (6 min)\n  ipconfig /release && ipconfig /renew && netsh winsock reset\n\nAfter all steps: run Verify Outcome within the app to open a 24h observation window.`,
        provenance: f,
      };
  }
}

export function usedByLabel(tool: AiToolId): string {
  for (const a of ACTION_META) if (a.id === tool) return a.label;
  return "AI action";
}

let demoFileCounter = 0;
export function uidFile(): string {
  demoFileCounter += 1;
  return `file-${Date.now()}-${demoFileCounter}`;
}