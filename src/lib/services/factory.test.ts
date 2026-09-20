import { describe, expect, it } from "vitest";

import {
  authService,
  caseService,
  contributionService,
  diagnosisService,
  isDemoMode,
  leaderboardService,
  notificationService,
  profileService,
  rewardService,
  walletService,
} from "@/lib/services";
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

describe("service factory", () => {
  it("resolves to the demo providers when demo mode is enabled", () => {
    expect(isDemoMode).toBe(true);
    expect(authService.constructor.name).toBe("DemoAuthService");
    expect(diagnosisService.constructor.name).toBe("DemoDiagnosisService");
    expect(caseService.constructor.name).toBe("DemoCaseService");
    expect(rewardService.constructor.name).toBe("DemoRewardService");
    expect(walletService.constructor.name).toBe("DemoWalletService");
    expect(contributionService.constructor.name).toBe("DemoContributionService");
    expect(leaderboardService.constructor.name).toBe("DemoLeaderboardService");
    expect(notificationService.constructor.name).toBe("DemoNotificationService");
    expect(profileService.constructor.name).toBe("DemoProfileService");
  });

  it("exposes an async startDiagnosis across both implementations", () => {
    const pending = diagnosisService.startDiagnosis(baseInput);
    expect(pending).toBeInstanceOf(Promise);
    void pending;
  });

  it("keeps chain verification out of the demo wallet provider", () => {
    expect(walletService.connect("MetaMask")).toBeInstanceOf(Promise);
    expect(walletService.requestChallenge).toBeUndefined();
    expect(walletService.verifyOwnership).toBeUndefined();
  });
});