export type CaseStatus =
  | "Suggested"
  | "Applied"
  | "Monitoring"
  | "Verified"
  | "Partially Verified"
  | "Failed"
  | "Needs Verification";

export type Severity = "Low" | "Medium" | "High" | "Critical";

export type CaseCategory =
  | "Coding Error"
  | "Windows / OS"
  | "Network & Wi-Fi"
  | "Hardware & Devices"
  | "Apps & Productivity"
  | "Performance"
  | "Security";

export type EvidenceKind = "screenshot" | "log" | "code" | "output" | "text";

export type OutcomeState = "resolved" | "partial" | "not-resolved";

export interface CaseEnvironment {
  os: string;
  device: string;
  version?: string;
  recentChange?: string;
}

export interface RankingFix {
  verifiedSuccessRate?: number | null;
  statisticalStatus?: string;
  trustLabel?: string;
  sourceType?: string;
  id: string;
  rank: number;
  title: string;
  why: string;
  successRate: number;
  matchScore: number;
  confidence: "High" | "Medium" | "Low";
  risk: "Low" | "Medium" | "High";
  effort: "Low" | "Medium" | "High";
  estimatedTime: string;
  steps: string[];
  category: string;
  tags: string[];
  verifiedCases: number;
  isTopPicked?: boolean;
}

export interface ObservationWindow {
  timeLabel: string;
  hoursElapsed: number;
  hoursTotal: number;
  complete: boolean;
}

export interface TimelineEvent {
  id: string;
  label: string;
  detail?: string;
  time: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "violet";
}

export interface ProbableCause {
  cause: string;
  likelihood: number;
}

export interface SimilarCaseRef {
  title: string;
  category: string;
  match: number;
  outcome: CaseStatus;
}

export interface AppCase {
  problemSummary?: string;
  confidenceBreakdown?: Record<string, number>;
  sources?: import("@/lib/api/mappers").ApiSource[];
  id: string;
  title: string;
  category: CaseCategory;
  status: CaseStatus;
  severity: Severity;
  symptom: string;
  description: string;
  environment: CaseEnvironment;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  confidence: number;
  successRate: number;
  matchedCases: number;
  selectedFixId: string | null;
  selectedFixTitle?: string;
  stepsDone: number;
  stepsTotal: number;
  reward: number;
  rewardStatus: "none" | "pending" | "claimable" | "claimed";
  evidence?: EvidenceKind[];
  outcome?: OutcomeState;
  verificationConfidence?: number;
  observation?: ObservationWindow;
  contributor?: string;
  contributorInitials?: string;
  fixes: RankingFix[];
  reasoning: ProbableCause[];
  similarCases: SimilarCaseRef[];
  timeline: TimelineEvent[];
  createdByMe?: boolean;
}

export interface DemoUser {
  id: string;
  name: string;
  username: string;
  handle: string;
  email: string;
  password: string;
  role: string;
  level: string;
  bio: string;
  location: string;
  memberSince: string;
  expertise: string[];
  badges: string[];
  reputation: number;
  reputationNext: number;
  verifiedOutcomes: number;
  contributions: number;
  successRate: number;
  casesResolved: number;
  streak: number;
  rank: number;
  avatarInitials: string;
  isDemo: boolean;
  /** Optional short subtitle rendered under the profile name (e.g. guest preview). */
  tagline?: string;
}

export type RewardNowType =
  | "Verified Outcome"
  | "Useful Fix"
  | "Royalty"
  | "Reward Share"
  | "Crowd Verification"
  | "Staked"
  | "Claimed"
  | "Earned";

export interface RewardItem {
  id: string;
  type: RewardNowType;
  title: string;
  amount: number;
  date: string;
  status: "pending" | "unlocked" | "completed";
}

export interface Transaction {
  id: string;
  label: string;
  amount: number;
  kind: "credit" | "debit";
  date: string;
  txHash: string;
  status: "pending" | "confirmed";
}

export interface RewardSnapshot {
  balance: number;
  claimable: number;
  lifetimeEarned: number;
  royalty: number;
  staked: number;
  stakingApr: number;
  claimableDetails: string;
  priceUsd: number;
  network: string;
  breakdown: { label: string; amount: number }[];
}

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "verifying"
  | "verified"
  | "wrong-network"
  | "error";

export type WalletProvider = "MetaMask" | "WalletConnect" | "Coinbase Wallet";

export interface WalletChallenge {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface WalletState {
  status: WalletStatus;
  provider: WalletProvider | null;
  address: string | null;
  shortAddress: string | null;
  network: string;
  lastError?: string;
  chainId?: number | null;
  verifiedAt?: string | null;
  challenge?: WalletChallenge | null;
}

export type NotificationKind = "reward" | "case" | "system";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: NotificationKind;
  unread: boolean;
  actionHref?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  title: string;
  reputation: number;
  verified: number;
  successRate: number;
  impact: string;
  fixEarned: number;
  movement: number;
  streak: number;
  badge?: string;
  isYou?: boolean;
}

export interface Contribution {
  id: string;
  caseId: string;
  title: string;
  category: CaseCategory;
  fix: string;
  reward: number;
  royalty: number;
  reuseCount: number;
  verifiedAt: string;
  outcome: CaseStatus;
  status: "Verified" | "Pending Review";
}

export type ContributionTaskType = "fix" | "verify" | "improve";

export interface ContributionTask {
  id: string;
  type: ContributionTaskType;
  title: string;
  category: CaseCategory;
  difficulty: "Easy" | "Moderate" | "Expert";
  rewardMin: number;
  rewardMax: number;
  stake: number;
  confidenceNeeded: number;
  urgency: "Low" | "Medium" | "High";
  casesAwaiting: number;
  description: string;
  verificationNeeded: string;
}

export interface DiagnosisInput {
  title: string;
  description: string;
  category: CaseCategory | "System";
  os: string;
  device: string;
  version: string;
  recentChange: string;
  evidence: EvidenceKind[];
  software?: string;
}

export interface AnalysisResult {
  summary: string;
  likelyCause: string;
  confidence: number;
  matchedCases: number;
  reasoning: ProbableCause[];
  fixes: RankingFix[];
  similarCases: SimilarCaseRef[];
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  delta: string;
  trend: "up" | "down" | "flat";
  icon: string;
  href?: string;
}

export interface InsightCardData {
  id: string;
  title: string;
  description: string;
  impact: string;
  href?: string;
  actionLabel?: string;
}

export interface ContinueCaseCard {
  id: string;
  title: string;
  status: string;
  confidence?: number;
  href: string;
}
