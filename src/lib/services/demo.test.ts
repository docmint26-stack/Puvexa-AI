import { beforeEach, describe, expect, it } from "vitest";

import {
  authService,
  diagnosisService,
  caseService,
  rewardService,
  walletService,
  contributionService,
} from "@/lib/services";
import { DEMO_CREDENTIALS } from "@/lib/demo/users";
import {
  rewardHistory as seedHistory,
  rewardSnapshot as seedSnapshot,
  transactions as seedTxs,
} from "@/lib/demo/rewards";
import { useAuthStore } from "@/lib/state/auth";
import { useCaseStore } from "@/lib/state/cases";
import { useRewardStore } from "@/lib/state/rewards";
import { useWalletStore } from "@/lib/state/wallet";
import { useNotificationStore } from "@/lib/state/notifications";
import { useGuestStore } from "@/lib/state/guest";
import { GUEST_POINTS_SEED } from "@/lib/demo/guest";
import type { DiagnosisInput } from "@/lib/demo/types";

const baseInput: DiagnosisInput = {
  title: "React hydration mismatch with timestamps",
  description: "The app throws a hydration error because a timestamp renders on the server.",
  category: "Coding Error",
  os: "macOS",
  device: "MacBook Pro",
  version: "Next.js 15",
  recentChange: "Upgraded React",
  evidence: ["text", "log"],
};

beforeEach(() => {
  useAuthStore.setState({ user: null, loginAt: null });
  useCaseStore.setState({ cases: [] });
  useRewardStore.setState({ ...seedSnapshot, history: seedHistory, transactions: seedTxs });
  useWalletStore.getState().disconnect();
  useNotificationStore.setState({ items: [] });
  useGuestStore.getState().resetGuest();
});

describe("auth service", () => {
  it("rejects invalid credentials", async () => {
    const res = await authService.login("nobody@puvexa.ai", "wrong");
    expect(res.ok).toBe(false);
    expect(authService.getUser()).toBeNull();
  });

  it("signs in with the demo account and can log out", async () => {
    const res = await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    expect(res.ok).toBe(true);
    expect(authService.getUser()?.email).toBe(DEMO_CREDENTIALS.email);
    authService.logout();
    expect(authService.getUser()).toBeNull();
  });

  it("creates and signs in a new account", async () => {
    const res = await authService.signup({
      name: "Test User",
      email: "test@example.com",
      username: "tester",
      password: "supersecret",
    });
    expect(res.ok).toBe(true);
    expect(authService.getUser()?.handle).toBe("@tester");
  });

  it("enforces signup validation", async () => {
    const res = await authService.signup({ name: "X", email: "bad", username: "x", password: "123" });
    expect(res.ok).toBe(false);
    expect(authService.getUser()).toBeNull();
  });
});

describe("diagnosis service", () => {
  it("maps Wi-Fi problems to the Wi-Fi analysis", () => {
    const result = diagnosisService.analyze({
      ...baseInput,
      title: "Wi-Fi keeps dropping",
      description: "My network adapter resets every 10 minutes after the update.",
    });
    expect(result.likelyCause.toLowerCase()).toContain("wi-fi");
    expect(result.matchedCases).toBeGreaterThan(100);
    expect(result.fixes.length).toBeGreaterThan(0);
  });

  it("falls back to the hydration analysis for unknown problems", () => {
    const result = diagnosisService.analyze(baseInput);
    expect(result.likelyCause.toLowerCase()).toContain("hydration");
  });

  it("creates a suggested case and a notification", async () => {
    const c = await diagnosisService.startDiagnosis(baseInput);
    expect(c.status).toBe("Suggested");
    expect(c.createdByMe).toBe(true);
    expect(caseService.get(c.id)).toBeDefined();
    expect(useNotificationStore.getState().items.length).toBeGreaterThan(0);
  });
});

describe("case progression + rewards", () => {
  it("moves a case from suggested to verified and unlocks the reward", async () => {
    const c = await diagnosisService.startDiagnosis(baseInput);
    const fix = c.fixes[0];
    caseService.applyFix(c.id, fix.id);
    expect(caseService.get(c.id)?.status).toBe("Applied");

    caseService.submitOutcome(c.id, "resolved");
    const monitoring = caseService.get(c.id);
    expect(monitoring?.status).toBe("Monitoring");
    expect(monitoring?.rewardStatus).toBe("none");

    const claimableBefore = useRewardStore.getState().claimable;
    const verified = caseService.finalizeVerification(c.id);
    expect(verified?.status).toBe("Verified");
    expect(caseService.get(c.id)?.rewardStatus).toBe("claimable");
    expect(useRewardStore.getState().claimable).toBeGreaterThan(claimableBefore);
  });
});

describe("rewards service", () => {
  it("claims claimable rewards into the balance", () => {
    const { claimable, balance } = rewardService.snapshot();
    expect(claimable).toBeGreaterThan(0);

    const res = rewardService.claim();
    expect(res.claimed).toBe(claimable);

    const after = rewardService.snapshot();
    expect(after.balance).toBe(balance + claimable);
    expect(after.claimable).toBe(0);

    const tx = rewardService.transactions()[0];
    expect(tx.status).toBe("pending");
    rewardService.confirmClaim(tx.id);
    expect(rewardService.transactions()[0].status).toBe("confirmed");
  });

  it("stakes FIX out of the balance and unstakes back", () => {
    const before = rewardService.snapshot();
    rewardService.stake(10);
    const staked = rewardService.snapshot();
    expect(staked.balance).toBe(before.balance - 10);
    expect(staked.staked).toBe(before.staked + 10);

    rewardService.unstake(10);
    expect(rewardService.snapshot().balance).toBe(before.balance);
  });
});

describe("wallet service", () => {
  it("connects, verifies and disconnects", async () => {
    const status = await walletService.connect("MetaMask");
    expect(status).toBe("verified");
    expect(walletService.state().shortAddress).toBeTruthy();
    expect(walletService.state().status).toBe("verified");

    walletService.disconnect();
    expect(walletService.state().status).toBe("disconnected");
  });
});

describe("contribution service", () => {
  it("submits a contribution and updates the contributor", async () => {
    await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    const before = authService.getUser()?.contributions ?? 0;

    const res = await contributionService.submit({
      type: "fix",
      title: "Test fix",
      description: "A verified test contribution.",
      steps: [],
      environment: "test",
      stake: 0,
    });

    expect(res.id).toBeTruthy();
    expect(authService.getUser()?.contributions).toBe(before + 1);
  });
});

describe("guest mode guards", () => {
  it("runs a diagnosis as a guest: guest points accrue, real notifications do not", async () => {
    useGuestStore.getState().enterGuest();
    await diagnosisService.startDiagnosis(baseInput);

    const guest = useGuestStore.getState();
    expect(guest.points).toBe(GUEST_POINTS_SEED + 10);
    expect(guest.stats.diagnoses).toBe(9);
    expect(guest.notifications.length).toBeGreaterThan(0);
    expect(useNotificationStore.getState().items).toHaveLength(0);
  });

  it("verifying a demo outcome as a guest grants preview points, never FIX", async () => {
    useGuestStore.getState().enterGuest();
    const c = await diagnosisService.startDiagnosis(baseInput);
    caseService.applyFix(c.id, c.fixes[0].id);
    caseService.submitOutcome(c.id, "resolved");
    const claimableBefore = useRewardStore.getState().claimable;
    caseService.finalizeVerification(c.id);

    const guest = useGuestStore.getState();
    expect(guest.stats.verifiedOutcomes).toBe(5);
    expect(guest.points).toBe(GUEST_POINTS_SEED + 10 + 20);
    expect(useRewardStore.getState().claimable).toBe(claimableBefore);
  });

  it("claiming as a guest is a no-op with a preview tx id", () => {
    useGuestStore.getState().enterGuest();
    const res = rewardService.claim();
    expect(res).toEqual({ claimed: 0, balanceAfter: 0, txId: expect.any(String) });

    const beforeStatus = rewardService.transactions()[0].status;
    rewardService.confirmClaim(res.txId);
    expect(rewardService.transactions()[0].status).toBe(beforeStatus);
  });

  it("staking as a guest does not move any balance", () => {
    useGuestStore.getState().enterGuest();
    const before = rewardService.snapshot();
    rewardService.stake(10);
    expect(rewardService.snapshot()).toEqual(before);
  });

  it("submitting a contribution as a guest only previews it", async () => {
    useGuestStore.getState().enterGuest();
    const res = await contributionService.submit({
      type: "fix",
      title: "Guest preview fix",
      description: "Never touches the economy.",
      steps: [],
      environment: "guest",
      stake: 50,
    });

    expect(res.id).toBe("guest-preview");
    expect(authService.getUser()).toBeNull();
    expect(rewardService.snapshot().staked).toBe(20);
  });

  it("signing up after guest mode prompts to keep progress", async () => {
    useGuestStore.getState().enterGuest();
    useGuestStore.getState().recordDiagnosis();

    await authService.signup({
      name: "Guest Turned Pro",
      email: "turned@example.com",
      username: "turnedpro",
      password: "supersecret",
    });

    const s = useGuestStore.getState();
    expect(s.mode).toBe("authenticated");
    expect(s.pendingUpgrade).toBe(true);
  });

  it("logging out clears guest mode", async () => {
    useGuestStore.getState().enterGuest();
    await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    authService.logout();
    expect(useGuestStore.getState().mode).toBe("anonymous");
  });
});
