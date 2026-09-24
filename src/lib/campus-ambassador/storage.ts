import { safeStorage } from "@/lib/state/storage";
import { AMBASSADOR_APPS_KEY, AMBASSADOR_DRAFT_KEY, type CampusAmbassadorApplication } from "./types";

type ApplicationsRecord = Record<string, CampusAmbassadorApplication>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    safeStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

export function readApplications(): ApplicationsRecord {
  const data = readJson(AMBASSADOR_APPS_KEY);
  return data && typeof data === "object" ? (data as ApplicationsRecord) : {};
}

export function saveApplications(apps: ApplicationsRecord): void {
  writeJson(AMBASSADOR_APPS_KEY, apps);
}

export function readApplicationDraft<T>(): T | null {
  const data = readJson(AMBASSADOR_DRAFT_KEY);
  return data && typeof data === "object" ? (data as T) : null;
}

export function saveApplicationDraft<T>(draft: T): void {
  writeJson(AMBASSADOR_DRAFT_KEY, draft);
}

export function clearApplicationDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AMBASSADOR_DRAFT_KEY);
  } catch {
    /* noop */
  }
}