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
  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore((s) => s.items.filter((n) => n.unread).length);
  return {
    items,
    unread,
    markRead: notificationService.markRead,
    markAllRead: notificationService.markAllRead,
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
