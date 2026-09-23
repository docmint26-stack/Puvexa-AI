import type { DemoUser, Kpi, LeaderboardEntry, NotificationItem } from "./types";

/**
 * Centralized guest session data (PUVERA-GUEST-25-...).
 *
 * Guest mode is a fully local, preview-only experience: nothing here is a
 * wallet balance, a real leaderboard rank, or real FIX. Every value is labeled
 * "Demo" / "Guest preview" in the UI so it can never be mistaken for a real
 * account, wallet, or token balance.
 */

export const GUEST_AI_RUNS_LIMIT = 3;
export const GUEST_POINTS_SEED = 120;

export const GUEST_PROFILE = {
  name: "Guest User",
  initials: "GU",
  handle: "@guest",
  title: "Guest Preview",
  tagline: "Exploring Puvexa as a guest.",
  badgeLabel: "GUEST",
  note: "Guest Points are a preview only — they are not FIX and cannot be claimed or transferred.",
};

/** Every place that renders an identity can reuse this as a light DemoUser. */
export const guestUserView: DemoUser = {
  id: "guest-user",
  name: "Guest User",
  username: "guest",
  handle: "@guest",
  email: "guest@puvexa.ai",
  password: "",
  role: "Guest",
  level: "Guest Preview",
  bio: "Exploring Puvexa as a guest — full product, no account, no wallet.",
  tagline: "Exploring Puvexa as a guest.",
  location: "Local preview",
  memberSince: "This session",
  expertise: ["Exploring"],
  badges: ["Guest"],
  reputation: 1250,
  reputationNext: 2000,
  verifiedOutcomes: 4,
  contributions: 3,
  successRate: 90,
  casesResolved: 6,
  streak: 1,
  rank: 24,
  avatarInitials: "GU",
  isDemo: true,
};

export const guestStats: Kpi[] = [
  {
    id: "g-1",
    label: "Cases Explored",
    value: 6,
    delta: "Sample cases in this session",
    trend: "up",
    icon: "circle-check",
    href: "/cases",
  },
  {
    id: "g-2",
    label: "AI Diagnoses",
    value: 8,
    delta: `${GUEST_AI_RUNS_LIMIT} AI Lab runs left`,
    trend: "up",
    icon: "cpu",
    href: "/lab",
  },
  {
    id: "g-3",
    label: "Verified Demo Outcomes",
    value: 4,
    delta: "24h observation — simulated",
    trend: "up",
    icon: "shield-check",
    href: "/cases",
  },
  {
    id: "g-4",
    label: "Guest Points",
    value: GUEST_POINTS_SEED,
    suffix: " pts",
    delta: "Preview only · not redeemable",
    trend: "up",
    icon: "sparkles",
    href: "/rewards",
  },
  {
    id: "g-5",
    label: "Leaderboard Preview",
    value: 24,
    delta: "Rank preview only",
    trend: "up",
    icon: "trophy",
    href: "/leaderboard",
  },
  {
    id: "g-6",
    label: "Knowledge Impact",
    value: 17,
    suffix: " reuses",
    delta: "Simulated reuse count",
    trend: "up",
    icon: "trending-up",
    href: "/profile",
  },
];

export const GUEST_LEADERBOARD_PREVIEW: LeaderboardEntry = {
  rank: 24,
  name: "Guest User",
  handle: "@guest",
  initials: "GU",
  title: "Guest Preview",
  reputation: 1250,
  verified: 4,
  successRate: 90,
  impact: "Demo preview only",
  fixEarned: 0,
  movement: 1,
  streak: 1,
  badge: "Preview only",
};

export const guestNextActions = [
  {
    id: "ga-1",
    title: "Run a diagnosis",
    description: "Describe a problem and get ranked, verified fixes — no account needed.",
    action: "New Diagnosis",
    href: "/diagnose",
    icon: "stethoscope",
    tone: "primary" as const,
  },
  {
    id: "ga-2",
    title: "Try the AI Lab",
    description: `${GUEST_AI_RUNS_LIMIT} free AI runs are included for guests.`,
    action: "Open lab",
    href: "/lab",
    icon: "flask-conical",
    tone: "accent" as const,
  },
  {
    id: "ga-3",
    title: "See how rewards work",
    description: "Explore the FIX economy before you decide to create an account.",
    action: "Explore",
    href: "/rewards",
    icon: "coins",
    tone: "success" as const,
  },
  {
    id: "ga-4",
    title: "Watch the walkthrough",
    description: "Follow How Puvexa Works — problem to proven solution, step by step.",
    action: "Workflow",
    href: "/how-it-works",
    icon: "play",
    tone: "violet" as const,
  },
];

export const guestNotifications: NotificationItem[] = [
  {
    id: "gn-1",
    title: "Welcome to guest mode",
    body: "Explore everything with a preview account. Guest Points are not FIX and cannot be claimed.",
    time: "Just now",
    kind: "system",
    unread: true,
    actionHref: "/rewards",
  },
  {
    id: "gn-2",
    title: "You have 3 free AI runs",
    body: "Use them in the AI Lab to diagnose sample problems and rank fixes.",
    time: "Just now",
    kind: "system",
    unread: true,
    actionHref: "/lab",
  },
  {
    id: "gn-3",
    title: "Sample evidence available",
    body: "Upload your own files or try real-looking sample evidence — everything stays local.",
    time: "Just now",
    kind: "case",
    unread: false,
    actionHref: "/diagnose",
  },
];

export const guestRewardSections = [
  {
    id: "gr-1",
    title: "Guest Points",
    description:
      "Earned by exploring cases and running demo diagnoses. Purely a preview of how incentives feel — you cannot claim them.",
    icon: "sparkles",
    tone: "violet",
    preview: "+10 per diagnosis · +20 per verified demo outcome",
  },
  {
    id: "gr-2",
    title: "How FIX rewards work",
    description:
      "Verified fixes earn FIX. Reused fixes earn royalties. Claims are settled to a wallet you own.",
    icon: "coins",
    tone: "cyan",
    preview: "Earn → Claim → Stake → Royalties",
  },
  {
    id: "gr-3",
    title: "Contribution Rewards",
    description:
      "Submit a verified walkthrough for an open problem and you earn a reward when the fix is verified.",
    icon: "shield-check",
    tone: "success",
    preview: "8–150 FIX per verified contribution",
  },
  {
    id: "gr-4",
    title: "Knowledge Royalties",
    description:
      "Every time your verified fix is reused by someone else, the network settles a recurring royalty.",
    icon: "trending-up",
    tone: "amber",
    preview: "0.4–6 FIX per tracked reuse",
  },
  {
    id: "gr-5",
    title: "Staking Preview",
    description:
      "Back a high-value contribution with FIX as an accountability stake. Returned in full when verified.",
    icon: "vault",
    tone: "emerald",
    preview: "No yield — trust, not interest",
  },
  {
    id: "gr-6",
    title: "On-chain Claim Preview",
    description:
      "Claimed rewards appear on the FIX testnet. Guests can preview the UI, but only an account can connect a wallet.",
    icon: "wallet",
    tone: "rose",
    preview: "Connect wallet after you sign up",
  },
];

export const guestAccountUnlocks = [
  { icon: "coins", title: "Real FIX balance", description: "Earn, hold, and claim a testnet balance tied to your account." },
  { icon: "trophy", title: "Your leaderboard rank", description: "Verified outcomes place you in the weekly rankings." },
  { icon: "vault", title: "Staking & royalties", description: "Stake confidence pools and accrue reuse royalties." },
  { icon: "wallet", title: "Wallet claims", description: "Connect a wallet and claim rewards on the FIX testnet." },
] as const;