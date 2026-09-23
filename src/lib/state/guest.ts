import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotificationItem } from "@/lib/demo/types";
import { GUEST_AI_RUNS_LIMIT, GUEST_POINTS_SEED } from "@/lib/demo/guest";
import { PERSIST_KEYS, jsonStorage, uid } from "@/lib/state/storage";

/**
 * Product-level session mode.
 *
 * - anonymous: no session (visitor / signed out)
 * - guest:      full preview experience, local-only, no account
 * - authenticated: a real (demo) account is active
 *
 * The guest identity is intentionally kept OUT of the auth store so the two
 * are never confused: guest mode can never mutate a user profile, reward a
 * wallet, or bump a real leaderboard entry.
 */
export type ProductMode = "anonymous" | "guest" | "authenticated";

export interface GuestStats {
  casesExplored: number;
  diagnoses: number;
  verifiedOutcomes: number;
  knowledgeImpact: number;
}

export type GuestNotificationItem = NotificationItem;

interface GuestState {
  mode: ProductMode;
  enteredAt: number | null;
  points: number;
  aiRunsUsed: number;
  tasks: Record<string, boolean>;
  stats: GuestStats;
  notifications: GuestNotificationItem[];
  /** True when the user already transferred their guest journey into an account. */
  preserved: boolean;
  /** Triggers the "Keep your guest progress?" dialog right after signup/login. */
  pendingUpgrade: boolean;
  /** Drives the modular "Create an account to continue" dialog. */
  gate: { open: boolean; message: string | null };

  enterGuest: () => void;
  leaveGuest: () => void;
  markAuthenticated: () => void;

  addPoints: (n: number) => void;
  useAiRun: () => boolean;
  completeTask: (id: string) => void;
  isTaskDone: (id: string) => boolean;

  recordDiagnosis: (points?: number) => void;
  recordVerify: (points?: number) => void;
  recordCaseExplored: () => void;
  recordKnowledgeImpact: (n?: number) => void;

  guestNotify: (
    title: string,
    body: string,
    kind?: NotificationItem["kind"],
    actionHref?: string
  ) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  setPendingUpgrade: (value: boolean) => void;
  openAuthGate: (message?: string) => void;
  closeAuthGate: () => void;

  transferGuestProgress: () => void;
  clearGuestProgress: () => void;
  resetGuest: () => void;
}

const initialStats: GuestStats = {
  casesExplored: 6,
  diagnoses: 8,
  verifiedOutcomes: 4,
  knowledgeImpact: 17,
};

const freshStats: GuestStats = {
  casesExplored: 0,
  diagnoses: 0,
  verifiedOutcomes: 0,
  knowledgeImpact: 0,
};

function welcomeMessages(): GuestNotificationItem[] {
  return [
    {
      id: uid("gn"),
      title: "Welcome to guest mode",
      body: "Explore everything with a preview account. Guest Points are not FIX and cannot be claimed.",
      time: "Just now",
      kind: "system",
      unread: true,
      actionHref: "/rewards",
    },
    {
      id: uid("gn"),
      title: "You have 3 free AI runs",
      body: "Use them in the AI Lab to diagnose sample problems and rank fixes.",
      time: "Just now",
      kind: "system",
      unread: true,
      actionHref: "/lab",
    },
  ];
}

function hasGuestProgress(s: GuestState): boolean {
  return (
    Object.keys(s.tasks).length > 0 ||
    s.stats.diagnoses > 0 ||
    s.stats.casesExplored > 0 ||
    s.stats.verifiedOutcomes > 0 ||
    s.points > GUEST_POINTS_SEED
  );
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      mode: "anonymous",
      enteredAt: null,
      points: GUEST_POINTS_SEED,
      aiRunsUsed: 0,
      tasks: {},
      stats: initialStats,
      notifications: [],
      preserved: false,
      pendingUpgrade: false,
      gate: { open: false, message: null },

      enterGuest: () =>
        set((s) => ({
          mode: "guest",
          enteredAt: Date.now(),
          points: s.mode === "guest" || s.preserved ? s.points : GUEST_POINTS_SEED,
          notifications: s.notifications.length > 0 ? s.notifications : welcomeMessages(),
          gate: { open: false, message: null },
        })),

      leaveGuest: () =>
        set({
          mode: "anonymous",
          enteredAt: null,
          points: GUEST_POINTS_SEED,
          aiRunsUsed: 0,
          tasks: {},
          stats: initialStats,
          notifications: [],
          preserved: false,
          pendingUpgrade: false,
          gate: { open: false, message: null },
        }),

      markAuthenticated: () =>
        set((s) => ({
          mode: "authenticated",
          gate: { open: false, message: null },
          pendingUpgrade: s.mode === "guest" && hasGuestProgress(s) ? true : s.pendingUpgrade,
        })),

      addPoints: (n) => set((s) => ({ points: Math.max(0, s.points + n) })),

      useAiRun: () => {
        const s = get();
        if (s.aiRunsUsed >= GUEST_AI_RUNS_LIMIT) return false;
        set({ aiRunsUsed: s.aiRunsUsed + 1 });
        return true;
      },

      completeTask: (id) =>
        set((s) => (s.tasks[id] ? s : { tasks: { ...s.tasks, [id]: true } })),

      isTaskDone: (id) => Boolean(get().tasks[id]),

      recordDiagnosis: (points = 10) =>
        set((s) => ({
          stats: { ...s.stats, diagnoses: s.stats.diagnoses + 1 },
          points: s.points + points,
          tasks: { ...s.tasks, "run-diagnosis": true },
        })),

      recordVerify: (points = 20) =>
        set((s) => ({
          stats: { ...s.stats, verifiedOutcomes: s.stats.verifiedOutcomes + 1 },
          points: s.points + points,
          tasks: { ...s.tasks, "verify-outcome": true },
        })),

      recordCaseExplored: () =>
        set((s) => ({
          stats: { ...s.stats, casesExplored: s.stats.casesExplored + 1 },
          tasks: { ...s.tasks, "explore-case": true },
        })),

      recordKnowledgeImpact: (n = 1) =>
        set((s) => ({
          stats: { ...s.stats, knowledgeImpact: s.stats.knowledgeImpact + n },
        })),

      guestNotify: (title, body, kind = "system", actionHref) =>
        set((s) => ({
          notifications: [
            {
              id: uid("gn"),
              title,
              body,
              time: "Just now",
              kind,
              unread: true,
              actionHref,
            },
            ...s.notifications,
          ],
        })),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, unread: false } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, unread: false })),
        })),

      setPendingUpgrade: (value) => set({ pendingUpgrade: value }),

      openAuthGate: (message) =>
        set({
          gate: {
            open: true,
            message: message ?? "Create a free account to unlock this action and keep your work.",
          },
        }),

      closeAuthGate: () => set({ gate: { open: false, message: null } }),

      transferGuestProgress: () =>
        set((s) => ({
          preserved: true,
          pendingUpgrade: false,
          notifications: [
            {
              id: uid("gn"),
              title: "Guest progress kept",
              body: "Your exploration is preserved. Now you can earn real FIX and verified rewards.",
              time: "Just now",
              kind: "system",
              unread: true,
              actionHref: "/dashboard",
            },
            ...s.notifications,
          ],
        })),

      clearGuestProgress: () =>
        set({
          preserved: false,
          pendingUpgrade: false,
          stats: freshStats,
          points: GUEST_POINTS_SEED,
          tasks: {},
          notifications: [
            {
              id: uid("gn"),
              title: "Welcome to your workspace",
              body: "Started fresh. Your guest preview data was cleared.",
              time: "Just now",
              kind: "system",
              unread: true,
            },
          ],
        }),

      resetGuest: () =>
        set({
          mode: "anonymous",
          enteredAt: null,
          points: GUEST_POINTS_SEED,
          aiRunsUsed: 0,
          tasks: {},
          stats: initialStats,
          notifications: [],
          preserved: false,
          pendingUpgrade: false,
          gate: { open: false, message: null },
        }),
    }),
    {
      name: PERSIST_KEYS.guest,
      storage: jsonStorage(),
    }
  )
);

export function useProductMode(): ProductMode {
  return useGuestStore((s) => s.mode);
}

export function useIsGuest(): boolean {
  return useGuestStore((s) => s.mode === "guest");
}

export function isGuestActive(): boolean {
  return useGuestStore.getState().mode === "guest";
}

export function useGuestAiRunsLeft(): number {
  return GUEST_AI_RUNS_LIMIT - useGuestStore((s) => s.aiRunsUsed);
}

export function guestAiRunsLeft(): number {
  const s = useGuestStore.getState();
  return Math.max(0, GUEST_AI_RUNS_LIMIT - s.aiRunsUsed);
}