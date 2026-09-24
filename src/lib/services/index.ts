import { DEMO_MODE } from "@/lib/demo/users";
import type {
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
import type { AmbassadorService } from "@/lib/campus-ambassador/types";
import * as demo from "./demo";
import {
  apiAuthService,
  apiCaseService,
  apiContributionService,
  apiDiagnosisService,
  apiLeaderboardService,
  apiNotificationService,
  apiProfileService,
  apiRewardService,
  apiWalletService,
} from "@/lib/api/services";
import { apiAmbassadorService } from "@/lib/api/ambassador";

export * from "./types";
export * from "@/lib/campus-ambassador/types";

export const isDemoMode = DEMO_MODE;

// The demo mode uses fully local, deterministic services. In production
// (NEXT_PUBLIC_DEMO_MODE !== "true") every service talks to the FastAPI
// backend through Supabase-authenticated API calls instead.
export const authService: AuthService = isDemoMode ? demo.authSvc : apiAuthService;
export const diagnosisService: DiagnosisService = isDemoMode ? demo.diagnosisSvc : apiDiagnosisService;
export const caseService: CaseService = isDemoMode ? demo.caseSvc : apiCaseService;
export const rewardService: RewardService = isDemoMode ? demo.rewardSvc : apiRewardService;
export const walletService: WalletService = isDemoMode ? demo.walletSvc : apiWalletService;
export const contributionService: ContributionService = isDemoMode ? demo.contributionSvc : apiContributionService;
export const leaderboardService: LeaderboardService = isDemoMode ? demo.leaderboardSvc : apiLeaderboardService;
export const notificationService: NotificationService = isDemoMode ? demo.notificationSvc : apiNotificationService;
export const profileService: ProfileService = isDemoMode ? demo.profileSvc : apiProfileService;
export const ambassadorService: AmbassadorService = isDemoMode ? demo.ambassadorSvc : apiAmbassadorService;