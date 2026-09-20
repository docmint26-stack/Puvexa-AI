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
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api/client";
import { pollDiagnosis, type DiagnosisOptions } from "./diagnosis";
import { getSessionUser, getAccessToken, signInWithPassword, signOutSession, signUpNewUser, requestPasswordReset, updateUserPassword } from "@/lib/api/supabase";
import {
  mapCase,
  mapContribution,
  mapLeaderboardEntry,
  mapNotification,
  mapProfile,
  mapRewardItem,
  mapRewardSummary,
  type ApiCaseDetail,
  type ApiContribution,
  type ApiLeaderboardRow,
  type ApiNotification,
  type ApiProfile,
  type ApiProfileStats,
  type ApiRewardLedger,
  type ApiRewardSummary,
} from "@/lib/api/mappers";
import { useAuthStore } from "@/lib/state/auth";
import { useCaseStore } from "@/lib/state/cases";
import { useRewardStore } from "@/lib/state/rewards";
import { useWalletStore } from "@/lib/state/wallet";
import { useNotificationStore } from "@/lib/state/notifications";
import { useLeaderboardStore } from "@/lib/state/leaderboard";
import { notify } from "@/lib/feedback";
import { connectWallet, disconnectWallet, describeWeb3Error, switchToChain } from "@/lib/web3/actions";
import { web3Config } from "@/lib/web3/config";
import { apiWeb3Service } from "@/lib/api/web3";
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
} from "@/lib/services/types";

export const WEB3_NOTICE =
  "Web3 claiming, staking, and wallet linking will be enabled after wallet verification and smart contract deployment.";

async function currentToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }
  return token;
}

function upsertCase(apiCase: ApiCaseDetail): AppCase {
  const mapped = mapCase(apiCase);
  useCaseStore.setState({
    cases: [mapped, ...useCaseStore.getState().cases.filter((c) => c.id !== mapped.id)],
  });
  return mapped;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export class ApiAuthService implements AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    const { error } = await signInWithPassword(email, password);
    if (error) return { ok: false, error };
    return this.establishSession();
  }

  async signup(data: { name: string; email: string; username: string; password: string }): Promise<AuthResult> {
    const { error } = await signUpNewUser(data.email, data.password);
    if (error) return { ok: false, error };
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      return this.establishSession();
    }
    return { ok: true };
  }

  logout(): void {
    void signOutSession().finally(() => {
      useAuthStore.getState().logout();
      useCaseStore.setState({ cases: [] });
      useRewardStore.setState({
        balance: 0,
        claimable: 0,
        lifetimeEarned: 0,
        royalty: 0,
        staked: 0,
        stakingApr: 0,
        claimableDetails: "",
        priceUsd: 0,
        network: "FIX",
        breakdown: [],
        history: [],
        transactions: [],
      });
      useWalletStore.getState().disconnect();
      useNotificationStore.setState({ items: [] });
      useLeaderboardStore.setState({ entries: [] });
    });
  }

  getUser(): DemoUser | null {
    return useAuthStore.getState().user;
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult> {
    const { error } = await requestPasswordReset(email, redirectTo);
    if (error) return { ok: false, error };
    return { ok: true };
  }

  async updatePassword(newPassword: string): Promise<AuthResult> {
    const { error } = await updateUserPassword(newPassword);
    if (error) return { ok: false, error };
    return { ok: true };
  }

  private async establishSession(): Promise<AuthResult> {
    try {
      const sessionUser = await getSessionUser();
      const token = await currentToken();
      const profile = await apiGet<ApiProfile>("/api/v1/auth/me", token);
      const stats = await apiGet<ApiProfileStats>("/api/v1/profile/stats", token);
      const user: DemoUser = { ...mapProfile(profile, stats), email: sessionUser?.email ?? "" };
      useAuthStore.setState({ user, loginAt: Date.now() });
      void hydrateWorkspace(token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Sign in failed. Please try again." };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Diagnosis                                                           */
/* ------------------------------------------------------------------ */

const PROD_STAGES: { label: string; detail: string }[] = [
  { label: "Case submitted", detail: "Details are stored against your account" },
  { label: "Server review", detail: "The backend matches context against verified fixes" },
  { label: "Recommendations", detail: "Ranked by evidence, pending trusted verification" },
];

export class ApiDiagnosisService implements DiagnosisService {
  stages(): { label: string; detail: string }[] {
    return PROD_STAGES;
  }

  analyze(input: DiagnosisInput): AnalysisResult {
    return {
      summary: `Server-side diagnosis is required to analyze "${input.title}".`,
      likelyCause: "Awaiting server diagnosis",
      confidence: 0,
      matchedCases: 0,
      reasoning: [],
      fixes: [],
      similarCases: [],
    };
  }

  async startDiagnosis(input: DiagnosisInput, options: DiagnosisOptions = {}): Promise<AppCase> {
    const token = await currentToken();
    const category = input.category === "System" ? "Windows / OS" : input.category;
    const created = options.caseId ? { id: options.caseId } : await apiPost<{ id: string }>(
      "/api/v1/cases",
      {
        title: input.title,
        description: input.description,
        category,
        severity: "medium",
        environment: {
          os: input.os,
          device: input.device,
          version: input.version,
          recentChange: input.recentChange,
        },
        software_name: input.software,
        software_version: input.version,
        operating_system: input.os,
        device_name: input.device,
        recent_changes: input.recentChange,
      },
      token
    );
    const run = await apiPost<{ id: string }>(`/api/v1/cases/${created.id}/diagnose`, undefined, token);
    await pollDiagnosis(run.id, created.id, token, options);
    const detail = await apiGet<ApiCaseDetail>(`/api/v1/cases/${created.id}`, token);
    const [diagnosis, recommendations, sources] = await Promise.all([
      apiGet<import("./mappers").ApiDiagnosis>(`/api/v1/diagnoses/${run.id}`, token),
      apiGet<import("./mappers").ApiRecommendation[]>(`/api/v1/diagnoses/${run.id}/recommendations`, token),
      apiGet<import("./mappers").ApiSource[]>(`/api/v1/diagnoses/${run.id}/sources`, token),
    ]);
    detail.diagnoses = [diagnosis];
    detail.recommendations = recommendations;
    detail.sources = sources;
    return upsertCase(detail);
  }
}

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

export class ApiCaseService implements CaseService {
  async refreshCase(id: string): Promise<void> {
    const token = await currentToken();
    upsertCase(await apiGet<ApiCaseDetail>(`/api/v1/cases/${id}`, token));
  }
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
    if (!c) return;
    const fix = c.fixes.find((f) => f.id === fixId);
    useCaseStore.getState().applyFix(id, fixId, fix?.title ?? "Fix", fix?.steps.length ?? 0);
    void (async () => {
      try {
        const token = await currentToken();
        await apiPost(`/api/v1/cases/${id}/attempts`, { fix_id: fixId }, token);
        const detail = await apiGet<ApiCaseDetail>(`/api/v1/cases/${id}`, token);
        upsertCase(detail);
      } catch (err) {
        notify.error("Fix not started", err instanceof ApiError ? err.message : "Could not start the fix.");
        const latest = await this.reloadCase(id);
        if (latest) upsertCase(latest);
      }
    })();
  }

  setStepsDone(id: string, done: number): void {
    useCaseStore.getState().setStepsDone(id, done);
    void (async () => {
      try {
        const token = await currentToken();
        const detail = await apiGet<ApiCaseDetail>(`/api/v1/cases/${id}`, token);
        const attemptId = detail.attempts?.[0]?.id;
        if (attemptId) {
          await apiPatch(`/api/v1/attempts/${attemptId}`, { steps_done: done }, token);
        }
      } catch (err) {
        const latest = await this.reloadCase(id);
        if (latest) upsertCase(latest);
        notify.error("Could not sync progress", err instanceof ApiError ? err.message : "Try again.");
      }
    })();
  }

  submitOutcome(id: string, outcome: OutcomeState): void {
    useCaseStore.getState().submitOutcome(id, outcome, 0);
    void (async () => {
      try {
        const token = await currentToken();
        const detail = await apiGet<ApiCaseDetail>(`/api/v1/cases/${id}`, token);
        const attemptId = detail.attempts?.[0]?.id;
        if (!attemptId) throw new ApiError(422, "NO_ATTEMPT", "Start a fix before submitting an outcome.");
        const reportedResult =
          outcome === "resolved" ? "resolved" : outcome === "partial" ? "partially_resolved" : "not_resolved";
        await apiPost(`/api/v1/attempts/${attemptId}/outcomes`, { reported_result: reportedResult, before_data: {}, after_data: {} }, token);
        const fresh = await apiGet<ApiCaseDetail>(`/api/v1/cases/${id}`, token);
        upsertCase(fresh);
        notify.info(
          "Outcome submitted",
          outcome === "resolved"
            ? "Verification started — a real observation window is open."
            : "Outcome recorded — the server will resolve it after review."
        );
      } catch (err) {
        notify.error("Outcome not saved", err instanceof ApiError ? err.message : "Could not submit the outcome.");
        const latest = await this.reloadCase(id);
        if (latest) upsertCase(latest);
      }
    })();
  }

  finalizeVerification(id: string): AppCase | undefined {
    // Production: the server verifies over the real observation window.
    void (async () => {
      const latest = await this.reloadCase(id);
      if (latest) upsertCase(latest);
    })();
    return this.get(id);
  }

  markFailed(id: string): void {
    // Production: not-resolved outcomes are recorded server-side already.
    void (async () => {
      const latest = await this.reloadCase(id);
      if (latest) upsertCase(latest);
    })();
  }

  private async reloadCase(id: string): Promise<ApiCaseDetail | undefined> {
    try {
      const token = await currentToken();
      return await apiGet<ApiCaseDetail>(`/api/v1/cases/${id}`, token);
    } catch {
      return undefined;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

export class ApiRewardService implements RewardService {
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
    const balance = useRewardStore.getState().balance;
    notify.info("Claiming not available yet", WEB3_NOTICE);
    return { claimed: 0, balanceAfter: balance, txId: "" };
  }

  confirmClaim(txId: string): void {
    // Claiming is deferred until smart contract deployment.
    void txId;
  }

  unlockCaseReward(caseId: string): void {
    // Rewards are unlocked server-side after trusted verification.
    void caseId;
  }

  stake(amount: number): void {
    notify.info("Staking not available yet", WEB3_NOTICE);
    void amount;
  }

  unstake(amount: number): void {
    notify.info("Staking not available yet", WEB3_NOTICE);
    void amount;
  }
}

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

export class ApiWalletService implements WalletService {
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
    const store = useWalletStore.getState();
    store.setConnecting(provider);
    try {
      const identity = await connectWallet();
      store.setChainId(identity.chainId);
      if (web3Config.chainId && identity.chainId !== web3Config.chainId) {
        store.setWrongNetwork(web3Config.chainId, identity.chainId);
        return "wrong-network" as const;
      }
      store.setConnected(identity.address, identity.chainId, web3Config.network, provider);
      return "connected";
    } catch (error) {
      const mapped = describeWeb3Error(error);
      store.fail(mapped.message);
      return "error";
    }
  }

  disconnect(): void {
    void disconnectWallet();
    useWalletStore.getState().disconnect();
  }

  async requestChallenge(address: string, chainId: number) {
    const challenge = await apiWeb3Service.requestChallenge(address, chainId);
    useWalletStore.getState().setChallenge(challenge);
    return challenge;
  }

  async verifyOwnership(params: { address: string; chainId: number; signature: string; nonce: string | null }) {
    const result = await apiWeb3Service.verifyWallet(params);
    if (result.status === "verified") {
      useWalletStore.getState().markVerified();
    }
    return result;
  }

  async switchNetwork(chainId: number): Promise<void> {
    await switchToChain(chainId);
    useWalletStore.getState().setChainId(chainId);
  }

  markWrongNetwork(): void {
    const s = useWalletStore.getState();
    s.setWrongNetwork(web3Config.chainId, s.chainId ?? null);
  }

  resolveError(): void {
    const s = useWalletStore.getState();
    if (s.address) {
      if (web3Config.chainId && s.chainId && s.chainId !== web3Config.chainId) {
        s.setWrongNetwork(web3Config.chainId, s.chainId);
      } else {
        s.setConnected(s.address, s.chainId ?? web3Config.chainId, web3Config.network, s.provider ?? "MetaMask");
      }
    }
    s.setLastError(undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Contributions                                                       */
/* ------------------------------------------------------------------ */

export class ApiContributionService implements ContributionService {
  private cachedMine: Contribution[] = [];

  tasks(): ContributionTask[] {
    // The backend exposes a tasks registry per phase; none ship in this phase.
    return [];
  }

  mine(): Contribution[] {
    return this.cachedMine;
  }

  async refreshMine(): Promise<void> {
    try {
      const token = await currentToken();
      const data = await apiGet<{ items: ApiContribution[] }>("/api/v1/contributions?page_size=100", token);
      this.cachedMine = (data.items ?? []).map(mapContribution);
    } catch {
      this.cachedMine = [];
    }
  }

  async submit(payload: {
    type: string;
    title: string;
    description: string;
    steps: string[];
    environment: string;
    stake: number;
  }): Promise<{ id: string }> {
    const token = await currentToken();
    const type = payload.type === "improve" ? "fix_improvement" : "new_fix";
    const created = await apiPost<{ id: string }>(
      "/api/v1/contributions",
      {
        contribution_type: type,
        title: payload.title,
        description: payload.description,
        evidence_summary: { steps: payload.steps, environment: payload.environment },
      },
      token
    );
    await this.refreshMine();
    return { id: created.id };
  }
}

/* ------------------------------------------------------------------ */
/* Leaderboard + Notifications + Profile                               */
/* ------------------------------------------------------------------ */

export class ApiLeaderboardService implements LeaderboardService {
  entries(): LeaderboardEntry[] {
    return useLeaderboardStore.getState().entries;
  }

  bumpUser(delta: { reputation: number; verified: number; fixEarned: number }): void {
    // The leaderboard is server-computed; refresh on the next hydrate.
    void delta;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const token = await currentToken();
      const data = await apiGet<{ items: ApiLeaderboardRow[] }>("/api/v1/leaderboard?period=weekly&page_size=100", token);
      useLeaderboardStore.setState({ entries: (data.items ?? []).map(mapLeaderboardEntry) });
    } catch {
      /* keep local copy */
    }
  }
}

export class ApiNotificationService implements NotificationService {
  list(): NotificationItem[] {
    return useNotificationStore.getState().items;
  }

  markRead(id: string): void {
    useNotificationStore.getState().markRead(id);
    void (async () => {
      try {
        const token = await currentToken();
        await apiPatch(`/api/v1/notifications/${id}/read`, {}, token);
      } catch {
        /* local-only is acceptable */
      }
    })();
  }

  markAllRead(): void {
    useNotificationStore.getState().markAllRead();
    void (async () => {
      try {
        const token = await currentToken();
        await apiPost("/api/v1/notifications/read-all", {}, token);
      } catch {
        /* local-only is acceptable */
      }
    })();
  }

  push(title: string, body: string, kind?: NotificationItem["kind"], actionHref?: string): void {
    useNotificationStore.getState().push(title, body, kind, actionHref);
  }
}

export class ApiProfileService implements ProfileService {
  get(): DemoUser | null {
    return useAuthStore.getState().user;
  }

  update(patch: Partial<DemoUser>): void {
    void (async () => {
      try {
        const token = await currentToken();
        const body: Record<string, string> = {};
        if (patch.name) body.display_name = patch.name;
        if (patch.username) body.username = patch.username.replace(/^@/, "");
        if (patch.bio) body.bio = patch.bio;
        const updated = await apiPatch<ApiProfile>("/api/v1/profile", body, token);
        const stats = await apiGet<ApiProfileStats>("/api/v1/profile/stats", token);
        useAuthStore.setState({ user: { ...mapProfile(updated, stats) } });
        notify.success("Profile updated", "Your public profile was saved.");
      } catch (err) {
        notify.error("Update failed", err instanceof ApiError ? err.message : "Could not save your profile.");
      }
    })();
  }
}

/* ------------------------------------------------------------------ */
/* Workspace hydration (shared by login + session restore)             */
/*                                                                     */
/* Must be imported lazily by client bootstrap to avoid a hard          */
/* dependency between client.ts and this module.                       */
/* ------------------------------------------------------------------ */

export async function hydrateWorkspace(token?: string): Promise<void> {
  const activeToken = token ?? (await currentToken());

  const [profile, stats, rewards, cases] = await Promise.all([
    apiGet<ApiProfile>("/api/v1/auth/me", activeToken),
    apiGet<ApiProfileStats>("/api/v1/profile/stats", activeToken),
    apiGet<ApiRewardSummary>("/api/v1/rewards/summary", activeToken),
    apiGet<{ items: ApiCaseDetail[] }>("/api/v1/cases?page_size=100", activeToken),
  ]);

  // Reward store: server-computed summary + ledger history.
  try {
    const historyData = await apiGet<{ items: ApiRewardLedger[] }>("/api/v1/rewards/history?page_size=50", activeToken);
    useRewardStore.setState({
      ...mapRewardSummary(rewards),
      history: (historyData.items ?? []).map(mapRewardItem),
      transactions: [],
    });
  } catch {
    useRewardStore.setState({ ...mapRewardSummary(rewards), history: [], transactions: [] });
  }

  // Cases: replace the local list with server state.
  useCaseStore.setState({ cases: (cases.items ?? []).map(mapCase) });

  // Leaderboard.
  try {
    const board = await apiGet<{ items: ApiLeaderboardRow[]; current_user_rank?: number | null }>(
      "/api/v1/leaderboard?period=weekly&page_size=100",
      activeToken
    );
    useLeaderboardStore.setState({ entries: (board.items ?? []).map(mapLeaderboardEntry) });
  } catch {
    useLeaderboardStore.setState({ entries: [] });
  }

  // Notifications.
  try {
    const notes = await apiGet<{ items: ApiNotification[] }>("/api/v1/notifications?page_size=50", activeToken);
    useNotificationStore.setState({ items: (notes.items ?? []).map(mapNotification) });
  } catch {
    useNotificationStore.setState({ items: [] });
  }

  // Contributions that the user previously submitted.
  await apiContributionService.refreshMine();

  // Profile: keep the freshest stats + a leaderboard rank if present.
  const sessionUser = await getSessionUser();
  const ranked = useLeaderboardStore.getState().entries;
  const rank = ranked.find((e) => e.isYou)?.rank ?? 0;
  useAuthStore.setState({
    user: { ...mapProfile(profile, stats), email: sessionUser?.email ?? useAuthStore.getState().user?.email ?? "", rank },
  });
}

/* ------------------------------------------------------------------ */
/* Concrete providers (used by the demo/production factory)            */
/* ------------------------------------------------------------------ */

export const apiAuthService = new ApiAuthService();
export const apiDiagnosisService = new ApiDiagnosisService();
export const apiCaseService = new ApiCaseService();
export const apiRewardService = new ApiRewardService();
export const apiWalletService = new ApiWalletService();
export const apiContributionService = new ApiContributionService();
export const apiLeaderboardService = new ApiLeaderboardService();
export const apiNotificationService = new ApiNotificationService();
export const apiProfileService = new ApiProfileService();
