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
import {
  findAnalysisFor,
} from "@/lib/demo/cases";
import { diagnosisStages } from "@/lib/demo/help";
import { contributionTasks, contributions } from "@/lib/demo/contributions";
import { useAuthStore } from "@/lib/state/auth";
import { useCaseStore } from "@/lib/state/cases";
import { useRewardStore } from "@/lib/state/rewards";
import { useWalletStore } from "@/lib/state/wallet";
import { useNotificationStore } from "@/lib/state/notifications";
import { useLeaderboardStore } from "@/lib/state/leaderboard";
import { isGuestActive, useGuestStore } from "@/lib/state/guest";
import { uid } from "@/lib/state/storage";
import { notify } from "@/lib/feedback";
import type {
  AuthResult,
  AuthService,
  CaseService,
  ContributionService,
  DiagnosisService,
  LeaderboardService,
  NotificationService,
  ProfileService,
  RewardService,
  WalletService,
} from "./types";

export class DemoAuthService implements AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    const res = await useAuthStore.getState().login(email, password);
    if (res.ok) useGuestStore.getState().markAuthenticated();
    return res;
  }
  async signup(data: { name: string; email: string; username: string; password: string }): Promise<AuthResult> {
    const res = await useAuthStore.getState().signup(data);
    if (res.ok) useGuestStore.getState().markAuthenticated();
    return res;
  }
  logout(): void {
    useGuestStore.getState().leaveGuest();
    useAuthStore.getState().logout();
  }
  getUser(): DemoUser | null {
    return useAuthStore.getState().user;
  }
  async requestPasswordReset(email: string): Promise<AuthResult> {
    await delay(600);
    const exists = useAuthStore.getState().user?.email === email;
    return exists
      ? { ok: true }
      : { ok: false, error: "Demo auth is local-only. Reset is available with Supabase configured." };
  }
  async updatePassword(): Promise<AuthResult> {
    await delay(600);
    return { ok: true };
  }
}

export class DemoDiagnosisService implements DiagnosisService {
  stages(): { label: string; detail: string }[] {
    return diagnosisStages.map((s) => ({ label: s.label, detail: s.detail }));
  }
  analyze(input: DiagnosisInput): AnalysisResult {
    return findAnalysisFor(input);
  }
  async startDiagnosis(input: DiagnosisInput): Promise<AppCase> {
    const analysis = this.analyze(input);
    const c = useCaseStore.getState().createDiagnosis(input, analysis);
    if (isGuestActive()) {
      const guest = useGuestStore.getState();
      guest.guestNotify(
        "Diagnosis ready",
        `Ranked fixes are ready for "${input.title}".`,
        "case",
        `/diagnose/${c.id}`
      );
      guest.recordDiagnosis(10);
      guest.recordKnowledgeImpact(1);
      return c;
    }
    useNotificationStore.getState().push(
      "Diagnosis ready",
      `Ranked fixes are ready for "${input.title}".`,
      "case",
      `/diagnose/${c.id}`
    );
    return c;
  }
}

export class DemoCaseService implements CaseService {
  list(): AppCase[] {
    return useCaseStore.getState().cases;
  }
  get(id: string): AppCase | undefined {
    return useCaseStore.getState().cases.find((c) => c.id === id);
  }
  setStatus(id: string, status: CaseStatus): void {
    useCaseStore.setState({
      cases: useCaseStore.getState().cases.map((c) => (c.id === id ? { ...c, status } : c)),
    });
  }
  applyFix(id: string, fixId: string): void {
    const c = this.get(id);
    const fix = c?.fixes.find((f) => f.id === fixId);
    if (!c || !fix) return;
    useCaseStore.getState().applyFix(id, fixId, fix.title, fix.steps.length);
    notify.info("Fix selected", `Trying "${fix.title}" — follow the steps to complete.`);
  }
  setStepsDone(id: string, done: number): void {
    useCaseStore.getState().setStepsDone(id, done);
  }
  submitOutcome(id: string, outcome: OutcomeState): void {
    const confidence = outcome === "resolved" ? 96 : outcome === "partial" ? 72 : 34;
    useCaseStore.getState().submitOutcome(id, outcome, confidence);
    notify.info(
      "Outcome submitted",
      outcome === "resolved"
        ? "Verification started — a 24h observation window is open."
        : "Outcome recorded — additional verification may be needed."
    );
  }
  finalizeVerification(id: string): AppCase | undefined {
    const c = useCaseStore.getState().completeVerification(id);
    if (c) {
      if (isGuestActive()) {
        // Guest sessions never touch real FIX — they accrue preview points only.
        const guest = useGuestStore.getState();
        guest.recordVerify(20);
        guest.guestNotify(
          "Demo outcome verified",
          "Your demo outcome passed. +20 Guest Points (preview only — not FIX).",
          "reward",
          "/rewards"
        );
        notify.success("Demo outcome verified", "+20 Guest Points added (preview).");
      } else {
        rewardSvc.unlockCaseReward(id);
      }
    }
    return c;
  }
  markFailed(id: string): void {
    useCaseStore.getState().markFailed(id);
  }
}

export class DemoRewardService implements RewardService {
  snapshot(): RewardSnapshot {
    const s = useRewardStore.getState();
    return {
      balance: s.balance,
      claimable: s.claimable,
      lifetimeEarned: s.lifetimeEarned,
      royalty: s.royalty,
      staked: s.staked,
      stakingApr: s.stakingApr,
      claimableDetails: s.claimableDetails,
      priceUsd: s.priceUsd,
      network: s.network,
      breakdown: s.breakdown,
    };
  }
  history(): RewardItem[] {
    return useRewardStore.getState().history;
  }
  transactions(): Transaction[] {
    return useRewardStore.getState().transactions;
  }
  claim(): { claimed: number; balanceAfter: number; txId: string } {
    if (isGuestActive()) return { claimed: 0, balanceAfter: 0, txId: uid("tx") };
    const res = useRewardStore.getState().claim();
    const tx = useRewardStore.getState().transactions[0];
    return { claimed: res.claimed, balanceAfter: res.balanceAfter, txId: tx?.id ?? uid("tx") };
  }
  confirmClaim(txId: string): void {
    if (isGuestActive()) return;
    useRewardStore.getState().confirmClaim(txId);
  }
  unlockCaseReward(caseId: string): void {
    if (isGuestActive()) return;
    const c = useCaseStore.getState().cases.find((x) => x.id === caseId);
    if (!c) return;
    useRewardStore.getState().addEarned({
      type: "Verified Outcome",
      title: `Verified outcome — ${c.title}`,
      amount: c.reward,
    });
    useLeaderboardStore.getState().bumpUser({ reputation: 40, verified: 1, fixEarned: c.reward });
    useAuthStore.getState().patchUser({
      verifiedOutcomes: (useAuthStore.getState().user?.verifiedOutcomes ?? 0) + 1,
      reputation: (useAuthStore.getState().user?.reputation ?? 0) + 40,
      contributions: (useAuthStore.getState().user?.contributions ?? 0) + 1,
      casesResolved: (useAuthStore.getState().user?.casesResolved ?? 0) + 1,
      successRate: 91,
    });
    useNotificationStore.getState().push(
      `+${c.reward} FIX reward unlocked`,
      `Your verified fix "${c.title}" is now claimable.`,
      "reward",
      "/rewards"
    );
    notify.success("Reward unlocked", `+${c.reward} FIX added to claimable.`);
  }
  stake(amount: number): void {
    if (isGuestActive()) return;
    useRewardStore.getState().stake(amount);
  }
  unstake(amount: number): void {
    if (isGuestActive()) return;
    useRewardStore.getState().unstake(amount);
  }
}

export class DemoWalletService implements WalletService {
  state() {
    const s = useWalletStore.getState();
    return {
      status: s.status,
      provider: s.provider,
      address: s.address,
      shortAddress: s.shortAddress,
      network: s.network,
    };
  }
  async connect(provider: WalletProvider): Promise<string> {
    return useWalletStore.getState().connect(provider);
  }
  disconnect(): void {
    useWalletStore.getState().disconnect();
  }
}

export class DemoContributionService implements ContributionService {
  tasks(): ContributionTask[] {
    return contributionTasks;
  }
  mine(): Contribution[] {
    return contributions;
  }
  async submit(payload: {
    type: string;
    title: string;
    description: string;
    steps: string[];
    environment: string;
    stake: number;
  }): Promise<{ id: string }> {
    await delay(1400);

    // Guests may browse and preview contributions, but never submit real ones:
    // no stake is moved, no profile is patched, nothing touches the economy.
    if (isGuestActive()) {
      useGuestStore.getState().guestNotify(
        "Contribution preview saved",
        `"${payload.title}" was previewed. Create an account to submit it for verification.`,
        "case",
        "/signup?next=/contribute"
      );
      return { id: "guest-preview" };
    }

    const id = uid("con");
    useNotificationStore.getState().push(
      "Contribution submitted",
      `Your fix "${payload.title}" is pending community verification.`,
      "case",
      "/contribute"
    );
    if (payload.stake > 0) {
      useRewardStore.getState().stake(payload.stake);
    }
    useAuthStore.getState().patchUser({
      contributions: (useAuthStore.getState().user?.contributions ?? 0) + 1,
      reputation: (useAuthStore.getState().user?.reputation ?? 0) + 10,
    });
    return { id };
  }
}

export class DemoLeaderboardService implements LeaderboardService {
  entries(): LeaderboardEntry[] {
    return useLeaderboardStore.getState().entries;
  }
  bumpUser(delta: { reputation: number; verified: number; fixEarned: number }): void {
    useLeaderboardStore.getState().bumpUser(delta);
  }
}

export class DemoNotificationService implements NotificationService {
  list(): NotificationItem[] {
    return useNotificationStore.getState().items;
  }
  markRead(id: string): void {
    useNotificationStore.getState().markRead(id);
  }
  markAllRead(): void {
    useNotificationStore.getState().markAllRead();
  }
  push(title: string, body: string, kind?: NotificationItem["kind"], actionHref?: string): void {
    useNotificationStore.getState().push(title, body, kind, actionHref);
  }
}

export class DemoProfileService implements ProfileService {
  get(): DemoUser | null {
    return useAuthStore.getState().user;
  }
  update(patch: Partial<DemoUser>): void {
    useAuthStore.getState().patchUser(patch);
  }
}

export const authSvc: AuthService = new DemoAuthService();
export const diagnosisSvc: DiagnosisService = new DemoDiagnosisService();
export const caseSvc: CaseService = new DemoCaseService();
export const rewardSvc: RewardService = new DemoRewardService();
export const walletSvc: WalletService = new DemoWalletService();
export const contributionSvc: ContributionService = new DemoContributionService();
export const leaderboardSvc: LeaderboardService = new DemoLeaderboardService();
export const notificationSvc: NotificationService = new DemoNotificationService();
export const profileSvc: ProfileService = new DemoProfileService();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}