import type { StateStorage } from "zustand/middleware";
import { createJSONStorage } from "zustand/middleware";

export const PERSIST_KEYS = {
  auth: "puvexa:auth",
  cases: "puvexa:cases",
  rewards: "puvexa:rewards",
  wallet: "puvexa:wallet",
  notifications: "puvexa:notifications",
  leaderboard: "puvexa:leaderboard",
  tour: "puvexa:tour",
  guest: "puvexa:guest",
} as const;

/** SSR-safe localStorage wrapper for zustand persist. */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* storage full / private mode — non-fatal */
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

export const jsonStorage = () => createJSONStorage(() => safeStorage);

/** Used by Settings → Reset Demo. Returns the list of cleared keys. */
export function clearDemoData(): string[] {
  if (typeof window === "undefined") return [];
  const keys = Object.values(PERSIST_KEYS);
  for (const k of keys) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  }
  return [...keys];
}

let seq = 0;
/** Tiny unique id generator usable inside quick-ticking demo actions. */
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export { createJSONStorage };