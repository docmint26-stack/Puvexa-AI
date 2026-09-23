import { beforeEach, describe, expect, it } from "vitest";

import { GUEST_AI_RUNS_LIMIT, GUEST_POINTS_SEED } from "@/lib/demo/guest";
import { useGuestStore } from "@/lib/state/guest";

beforeEach(() => {
  useGuestStore.getState().resetGuest();
});

describe("guest store — session mode", () => {
  it("starts anonymous with the seeded guest points", () => {
    const s = useGuestStore.getState();
    expect(s.mode).toBe("anonymous");
    expect(s.points).toBe(GUEST_POINTS_SEED);
    expect(s.aiRunsUsed).toBe(0);
  });

  it("enters guest mode with welcome notifications and preserves points across re-entry", () => {
    useGuestStore.getState().enterGuest();
    expect(useGuestStore.getState().mode).toBe("guest");
    expect(useGuestStore.getState().notifications.length).toBeGreaterThan(0);

    useGuestStore.getState().addPoints(25);
    useGuestStore.getState().enterGuest();
    expect(useGuestStore.getState().mode).toBe("guest");
    expect(useGuestStore.getState().points).toBe(GUEST_POINTS_SEED + 25);
  });

  it("leaveGuest returns to anonymous and resets to the seeded snapshot", () => {
    useGuestStore.getState().enterGuest();
    useGuestStore.getState().recordDiagnosis();
    useGuestStore.getState().leaveGuest();
    const s = useGuestStore.getState();
    expect(s.mode).toBe("anonymous");
    expect(s.points).toBe(GUEST_POINTS_SEED);
    expect(s.stats.diagnoses).toBe(8);
    expect(s.notifications).toHaveLength(0);
  });
});

describe("guest store — AI runs", () => {
  it("consumes runs up to the guest limit then refuses", () => {
    useGuestStore.getState().enterGuest();
    let ok = true;
    for (let i = 0; i < GUEST_AI_RUNS_LIMIT; i++) {
      ok = useGuestStore.getState().useAiRun();
    }
    expect(ok).toBe(true);
    expect(useGuestStore.getState().aiRunsUsed).toBe(GUEST_AI_RUNS_LIMIT);
    expect(useGuestStore.getState().useAiRun()).toBe(false);
  });
});

describe("guest store — preview points", () => {
  it("recordDiagnosis adds 10 points and tracks the task", () => {
    useGuestStore.getState().enterGuest();
    const before = useGuestStore.getState().points;
    useGuestStore.getState().recordDiagnosis();
    const s = useGuestStore.getState();
    expect(s.points).toBe(before + 10);
    expect(s.stats.diagnoses).toBe(9);
    expect(s.isTaskDone("run-diagnosis")).toBe(true);
  });

  it("recordVerify adds 20 points", () => {
    useGuestStore.getState().enterGuest();
    const before = useGuestStore.getState().points;
    useGuestStore.getState().recordVerify();
    expect(useGuestStore.getState().points).toBe(before + 20);
    expect(useGuestStore.getState().stats.verifiedOutcomes).toBe(5);
  });
});

describe("guest store — account upgrade", () => {
  it("markAuthenticated prompts to keep progress when the guest did something", () => {
    useGuestStore.getState().enterGuest();
    useGuestStore.getState().recordDiagnosis();
    useGuestStore.getState().markAuthenticated();
    const s = useGuestStore.getState();
    expect(s.mode).toBe("authenticated");
    expect(s.pendingUpgrade).toBe(true);
  });

  it("markAuthenticated prompts to keep progress after any guest session", () => {
    useGuestStore.getState().enterGuest();
    useGuestStore.getState().markAuthenticated();
    expect(useGuestStore.getState().pendingUpgrade).toBe(true);
  });

  it("transferGuestProgress keeps the journey and turns the prompt off", () => {
    useGuestStore.getState().enterGuest();
    useGuestStore.getState().recordDiagnosis();
    useGuestStore.getState().markAuthenticated();
    useGuestStore.getState().transferGuestProgress();
    const s = useGuestStore.getState();
    expect(s.preserved).toBe(true);
    expect(s.pendingUpgrade).toBe(false);
    expect(s.points).toBe(GUEST_POINTS_SEED + 10);
  });

  it("clearGuestProgress resets stats but keeps the account", () => {
    useGuestStore.getState().enterGuest();
    useGuestStore.getState().recordDiagnosis();
    useGuestStore.getState().markAuthenticated();
    useGuestStore.getState().clearGuestProgress();
    const s = useGuestStore.getState();
    expect(s.mode).toBe("authenticated");
    expect(s.preserved).toBe(false);
    expect(s.stats).toEqual({ casesExplored: 0, diagnoses: 0, verifiedOutcomes: 0, knowledgeImpact: 0 });
  });
});

describe("guest store — auth gate", () => {
  it("opens and closes the gate with a custom message", () => {
    useGuestStore.getState().openAuthGate("Create an account to contribute.");
    expect(useGuestStore.getState().gate).toEqual({ open: true, message: "Create an account to contribute." });

    useGuestStore.getState().closeAuthGate();
    expect(useGuestStore.getState().gate.open).toBe(false);
  });
});