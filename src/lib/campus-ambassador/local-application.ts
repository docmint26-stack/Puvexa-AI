import {
  AMBASSADOR_APPLICATION_KEY,
  type AmbassadorApplicationPayload,
  type StoredAmbassadorApplication,
} from "./types";

/**
 * Frontend-only campus ambassador application.
 *
 * Until the review system ships, the campus ambassador application lives
 * entirely on the device: no backend, no API, no sign-in required.
 */
export const CAMPUS_AMBASSADOR_LOCAL_MODE = true;

/** Thrown when the browser refuses to persist the application (private mode, quota…). */
export class AmbassadorLocalSaveError extends Error {
  constructor() {
    super("We couldn't save your application on this device. Please try again.");
    this.name = "AmbassadorLocalSaveError";
  }
}

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I / O / 0 / 1 confusion

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return out;
}

/** Generates a unique-looking local reference, e.g. "PCA-2026-A8F42C". */
export function generateAmbassadorApplicationId(): string {
  return `PCA-${new Date().getFullYear()}-${randomCode(6)}`;
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AMBASSADOR_APPLICATION_KEY);
  } catch {
    return null;
  }
}

/** Returns the locally stored application, or null when none exists / storage is unavailable. */
export function getAmbassadorApplication(): StoredAmbassadorApplication | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const app = parsed as Partial<StoredAmbassadorApplication>;
    if (typeof app.applicationId !== "string" || app.status !== "submitted") return null;
    if (!app.details || typeof app.details !== "object") return null;
    return parsed as StoredAmbassadorApplication;
  } catch {
    return null;
  }
}

/** True when this device already holds a submitted campus ambassador application. */
export function hasAmbassadorApplication(): boolean {
  return getAmbassadorApplication() !== null;
}

/**
 * Saves the submitted application locally.
 * Throws AmbassadorLocalSaveError when the device refuses to persist it.
 */
export function saveAmbassadorApplication(
  payload: AmbassadorApplicationPayload
): StoredAmbassadorApplication {
  const applicationId = generateAmbassadorApplicationId();
  const record: StoredAmbassadorApplication = {
    id: applicationId,
    applicationId,
    fullName: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    status: "submitted",
    submittedAt: new Date().toISOString(),
    details: payload,
  };
  try {
    if (typeof window === "undefined") {
      throw new Error("no window");
    }
    window.localStorage.setItem(AMBASSADOR_APPLICATION_KEY, JSON.stringify(record));
  } catch {
    throw new AmbassadorLocalSaveError();
  }
  return record;
}

/** Removes the locally stored application (used for testing / future reset). */
export function clearAmbassadorApplication(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AMBASSADOR_APPLICATION_KEY);
  } catch {
    /* noop */
  }
}