import { useEffect } from "react";
import type {
  AppCase,
  Contribution,
  ContributionTask,
  DemoUser,
  LeaderboardEntry,
  WalletState,
} from "@/lib/demo/types";
import {
  useAuthStore,
} from "@/lib/state/auth";
import { useCaseStore } from "@/lib/state/cases";
import { useRewardStore } from "@/lib/state/rewards";
import { useWalletStore } from "@/lib/state/wallet";
import { useNotificationStore } from "@/lib/state/notifications";
import { useLeaderboardStore } from "@/lib/state/leaderboard";
import { useTourStore } from "@/lib/state/ui";
import {
  useGuestStore,
  useIsGuest,
} from "@/lib/state/guest";
export { useProductMode, useIsGuest, isGuestActive, guestAiRunsLeft } from "@/lib/state/guest";
import { guestUserView } from "@/lib/demo/guest";
import {
  diagnosisService,
  rewardService,
  walletService,
  notificationService,
  leaderboardService,
  contributionService,
  authService,
  caseService,
} from "@/lib/services";
import type { ContributionService } from "@/lib/services";

export function useCurrentUser(): DemoUser | null {
  return useAuthStore((s) => s.user);
}

/**
 * The identity the current session should render: the real account when
 * authenticated, the preview identity while exploring as a guest, otherwise
 * null.
 */
export function useActiveUser(): DemoUser | null {
  const user = useAuthStore((s) => s.user);
  const guest = useIsGuest();
  return user ?? (guest ? guestUserView : null);
}

export function useGuestScoreboard() {
  const points = useGuestStore((s) => s.points);
  const aiRunsUsed = useGuestStore((s) => s.aiRunsUsed);
  const tasks = useGuestStore((s) => s.tasks);
  const stats = useGuestStore((s) => s.stats);
  const preserved = useGuestStore((s) => s.preserved);
  return { points, aiRunsUsed, tasksDone: Object.keys(tasks).length, stats, preserved };
}

export function useGuestActions() {
  const s = useGuestStore;
  return {
    enter: s.getState().enterGuest,
    leave: s.getState().leaveGuest,
    addPoints: s.getState().addPoints,
    useAiRun: s.getState().useAiRun,
    completeTask: s.getState().completeTask,
    recordDiagnosis: s.getState().recordDiagnosis,
    recordVerify: s.getState().recordVerify,
    recordCaseExplored: s.getState().recordCaseExplored,
    guestNotify: s.getState().guestNotify,
    setPendingUpgrade: s.getState().setPendingUpgrade,
    openAuthGate: s.getState().openAuthGate,
    closeAuthGate: s.getState().closeAuthGate,
    transferGuestProgress: s.getState().transferGuestProgress,
    clearGuestProgress: s.getState().clearGuestProgress,
  };
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.user !== null);
}

export function useAuthActions() {
  return {
    login: authService.login,
    signup: authService.signup,
    logout: authService.logout,
    requestPasswordReset: authService.requestPasswordReset?.bind(authService),
    updatePassword: authService.updatePassword?.bind(authService),
  };
}

export function useCases(): AppCase[] {
  return useCaseStore((s) => s.cases);
}

export function useCase(id: string): AppCase | undefined {
  useEffect(() => {
    void caseService.refreshCase?.(id).catch(() => undefined);
  }, [id]);
  return useCaseStore((s) => s.cases.find((c) => c.id === id));
}

export function useCaseActions() {
  return {
    applyFix: caseService.applyFix,
    setStepsDone: caseService.setStepsDone,
    submitOutcome: caseService.submitOutcome,
    finalizeVerification: caseService.finalizeVerification,
    markFailed: caseService.markFailed,
    list: caseService.list,
  };
}

export function useDiagnosis() {
  return {
    stages: () => diagnosisService.stages(),
    analyze: diagnosisService.analyze,
    startDiagnosis: diagnosisService.startDiagnosis,
  };
}

export function useRewards() {
  const balance = useRewardStore((s) => s.balance);
  const claimable = useRewardStore((s) => s.claimable);
  const lifetimeEarned = useRewardStore((s) => s.lifetimeEarned);
  const royalty = useRewardStore((s) => s.royalty);
  const staked = useRewardStore((s) => s.staked);
  const history = useRewardStore((s) => s.history);
  const transactions = useRewardStore((s) => s.transactions);
  const breakdown = useRewardStore((s) => s.breakdown);
  return {
    balance,
    claimable,
    lifetimeEarned,
    royalty,
    staked,
    history,
    transactions,
    breakdown,
    snapshot: () => rewardService.snapshot(),
    claim: rewardService.claim,
    confirmClaim: rewardService.confirmClaim,
    stake: rewardService.stake,
    unstake: rewardService.unstake,
  };
}

export function useWallet() {
  const status = useWalletStore((s) => s.status);
  const provider = useWalletStore((s) => s.provider);
  const address = useWalletStore((s) => s.address);
  const shortAddress = useWalletStore((s) => s.shortAddress);
  const network = useWalletStore((s) => s.network);
  const lastError = useWalletStore((s) => s.lastError);
  const chainId = useWalletStore((s) => s.chainId);
  const verifiedAt = useWalletStore((s) => s.verifiedAt);
  const challenge = useWalletStore((s) => s.challenge);
  const state: Partial<WalletState> = { status, provider, address, shortAddress, network, lastError, chainId, verifiedAt, challenge };
  return {
    state,
    connect: walletService.connect,
    disconnect: walletService.disconnect,
    requestChallenge: walletService.requestChallenge,
    verifyOwnership: walletService.verifyOwnership,
    switchNetwork: walletService.switchNetwork,
    markWrongNetwork: walletService.markWrongNetwork,
    resolveError: walletService.resolveError,
  };
}

export function useLeaderboard(): LeaderboardEntry[] {
  return useLeaderboardStore((s) => s.entries);
}

export function useNotifications() {
  const guest = useIsGuest();
  const guestItems = useGuestStore((s) => s.notifications);
  const accountItems = useNotificationStore((s) => s.items);
  const items = guest ? guestItems : accountItems;
  const unread = items.filter((n) => n.unread).length;
  const markRead = useGuestStore.getState().markNotificationRead;
  const markAllRead = useGuestStore.getState().markAllNotificationsRead;
  return {
    items,
    unread,
    markRead: guest ? markRead : notificationService.markRead,
    markAllRead: guest ? markAllRead : notificationService.markAllRead,
    push: notificationService.push,
  };
}

export function useContributions(): {
  tasks: ContributionTask[];
  mine: Contribution[];
  submit: ContributionService["submit"];
} {
  return {
    tasks: contributionService.tasks(),
    mine: contributionService.mine(),
    submit: contributionService.submit,
  };
}

export function useTour() {
  const seen = useTourStore((s) => s.seen);
  const active = useTourStore((s) => s.active);
  return {
    seen,
    active,
    start: useTourStore.getState().start,
    complete: useTourStore.getState().complete,
    end: useTourStore.getState().end,
  };
}

export function useLeaderboardActions() {
  return { bumpUser: leaderboardService.bumpUser };
}
