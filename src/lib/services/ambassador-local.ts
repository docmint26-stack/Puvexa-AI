import {
  AMBASSADOR_ALREADY_APPLIED,
  AmbassadorSubmissionError,
  type AmbassadorApplicationPayload,
  type AmbassadorService,
  type StoredAmbassadorApplication,
} from "@/lib/campus-ambassador/types";
import {
  getAmbassadorApplication,
  hasAmbassadorApplication,
  saveAmbassadorApplication,
} from "@/lib/campus-ambassador/local-application";
import { clearApplicationDraft } from "@/lib/campus-ambassador/storage";

/** Keep the submit button visibly working while the local save completes. */
const SUBMIT_LATENCY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Frontend-only ambassador service: everything happens on this device.
 * No backend, no API, no sign-in required — guests and anonymous visitors
 * both complete the same flow.
 */
export const localAmbassadorService: AmbassadorService = {
  async submitApplication(payload: AmbassadorApplicationPayload): Promise<StoredAmbassadorApplication> {
    const existing = hasAmbassadorApplication();
    if (existing) {
      const current = getAmbassadorApplication();
      const applicationId = current?.applicationId ?? "—";
      throw new AmbassadorSubmissionError(
        AMBASSADOR_ALREADY_APPLIED,
        `You already submitted an application for this device (${applicationId}).`,
        409,
        { applicationId }
      );
    }
    await delay(SUBMIT_LATENCY_MS);
    const record = saveAmbassadorApplication(payload);
    clearApplicationDraft();
    return record;
  },

  async getMyApplication(): Promise<StoredAmbassadorApplication | null> {
    return getAmbassadorApplication();
  },
};