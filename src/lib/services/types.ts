import type {
  AnalysisResult,
  AppCase,
  CaseStatus,
  Contribution,
  ContributionTask,
  DemoUser,
  DiagnosisInput,
  LeaderboardEntry,
  NotificationItem,
  OutcomeState,
  RewardItem,
  RewardSnapshot,
  Transaction,
  WalletProvider,
} from "@/lib/demo/types";
import type { WalletChallenge } from "@/lib/web3/types";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export interface AuthService {
  login(email: string, password: string): Promise<AuthResult>;
  signup(data: { name: string; email: string; username: string; password: string }): Promise<AuthResult>;
  logout(): void;
  getUser(): DemoUser | null;
  /** Sends a recovery email via the configured auth provider (Supabase). */
  requestPasswordReset?(email: string, redirectTo: string): Promise<AuthResult>;
  /** Sets a new password for the current (recovery) session. */
  updatePassword?(newPassword: string): Promise<AuthResult>;
}

export interface DiagnosisService {
  stages(): { label: string; detail: string }[];
  analyze(input: DiagnosisInput): AnalysisResult;
  startDiagnosis(input: DiagnosisInput, options?: import("@/lib/api/diagnosis").DiagnosisOptions): Promise<AppCase>;
}

export interface CaseService {
  refreshCase?(id: string): Promise<void>;
  list(): AppCase[];
  get(id: string): AppCase | undefined;
  setStatus(id: string, status: CaseStatus): void;
  applyFix(id: string, fixId: string): void;
  setStepsDone(id: string, done: number): void;
  submitOutcome(id: string, outcome: OutcomeState): void;
  /** Completes the (simulated) observation window and returns the verified case. */
  finalizeVerification(id: string): AppCase | undefined;
  markFailed(id: string): void;
}

export interface RewardService {
  snapshot(): RewardSnapshot;
  history(): RewardItem[];
  transactions(): Transaction[];
  claim(): { claimed: number; balanceAfter: number; txId: string };
  confirmClaim(txId: string): void;
  unlockCaseReward(caseId: string): void;
  stake(amount: number): void;
  unstake(amount: number): void;
}

export interface WalletService {
  state(): { status: string; provider: WalletProvider | null; address: string | null; shortAddress: string | null; network: string };
  connect(provider: WalletProvider): Promise<string>;
  disconnect(): void;
  /** Production only: request a one-time ownership challenge from the backend. */
  requestChallenge?(address: string, chainId: number): Promise<WalletChallenge>;
  /** Production only: submit the signed challenge to prove wallet ownership. */
  verifyOwnership?(params: { address: string; chainId: number; signature: string; nonce: string | null }): Promise<{ status: string; walletAddress: string }>;
  /** Production only: switch the connected chain (e.g. to the configured testnet). */
  switchNetwork?(chainId: number): Promise<void>;
  /** Production only: record that the connected chain does not match the app chain. */
  markWrongNetwork?(): void;
  /** Production only: clear transient error state back to a usable connection state. */
  resolveError?(): void;
}

export interface ContributionService {
  tasks(): ContributionTask[];
  mine(): Contribution[];
  submit(payload: {
    type: string;
    title: string;
    description: string;
    steps: string[];
    environment: string;
    stake: number;
  }): Promise<{ id: string }>;
}

export interface LeaderboardService {
  entries(): LeaderboardEntry[];
  bumpUser(delta: { reputation: number; verified: number; fixEarned: number }): void;
}

export interface NotificationService {
  list(): NotificationItem[];
  markRead(id: string): void;
  markAllRead(): void;
  push(title: string, body: string, kind?: NotificationItem["kind"], actionHref?: string): void;
}

export interface ProfileService {
  get(): DemoUser | null;
  update(patch: Partial<DemoUser>): void;
}
