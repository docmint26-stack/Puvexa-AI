import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AMBASSADOR_ALREADY_APPLIED,
  AmbassadorSubmissionError,
  type AmbassadorApplicationPayload,
  type StoredAmbassadorApplication,
} from "@/lib/campus-ambassador/types";
import {
  clearAmbassadorApplication,
  getAmbassadorApplication,
  hasAmbassadorApplication,
  saveAmbassadorApplication,
  AmbassadorLocalSaveError,
} from "@/lib/campus-ambassador/local-application";
import {
  clearApplicationDraft,
  readApplicationDraft,
  saveApplicationDraft,
} from "@/lib/campus-ambassador/storage";
import { ambassadorService } from "@/lib/services";

function validPayload(): AmbassadorApplicationPayload {
  return {
    fullName: "Ada Lovelace",
    email: " Ada@Example.com ",
    phone: "+1 555 000 1234",
    country: "Nigeria",
    city: "Lagos",
    institution: "University of Lagos",
    program: "BSc Computer Science",
    graduationYear: 2027,
    currentStudent: true,
    clubInvolvement: "Google Developer Student Club",
    leadershipExperience: true,
    leadershipDescription: "Organized a 120-person hackathon",
    motivation: "I love helping classmates debug their projects and want to grow a fix-first community on campus.",
    communityGoals: "I want to host monthly problem-solving workshops and make verified fixes a habit in my CS club.",
    githubUrl: "https://github.com/ada",
    linkedinUrl: undefined,
    otherSocialUrl: undefined,
    audienceCount: 500,
    technicalLevel: "intermediate",
    skillTags: ["Community Management", "AI & Machine Learning"],
    weeklyHours: 5,
    availabilityMonths: 6,
    timezone: "WAT — Lagos",
    resourcesNeeded: "Event templates and a starter kit for the first workshop.",
    previousAmbassador: false,
    previousAmbassadorDetails: undefined,
    consent: true,
  };
}

beforeEach(() => {
  clearAmbassadorApplication();
  clearApplicationDraft();
});

describe("frontend-only campus ambassador flow", () => {
  it("submits and generates a local application with status submitted and a timestamp", async () => {
    const record = await ambassadorService.submitApplication(validPayload());

    expect(record.applicationId).toMatch(/^PCA-\d{4}-[A-Z0-9]{6}$/);
    expect(record.status).toBe("submitted");
    expect(Number.isNaN(Date.parse(record.submittedAt))).toBe(false);
    expect(record.fullName).toBe("Ada Lovelace");
    expect(record.email).toBe("ada@example.com");
    expect(new Date(record.submittedAt).getFullYear()).toBe(new Date().getFullYear());
  });

  it("stores all submitted form fields alongside the summary", async () => {
    const record = (await ambassadorService.submitApplication(
      validPayload()
    )) as StoredAmbassadorApplication;

    expect(record.details).toMatchObject(validPayload());
    expect(record.details.institution).toBe("University of Lagos");
    expect(record.details.skillTags).toContain("AI & Machine Learning");
  });

  it("remembers the application after a refresh (re-read from localStorage)", async () => {
    await ambassadorService.submitApplication(validPayload());

    // Re-reading from storage simulates a page refresh — no in-memory state.
    const restored = getAmbassadorApplication();
    expect(restored?.applicationId).toMatch(/^PCA-\d{4}-[A-Z0-9]{6}$/);
    expect(restored?.email).toBe("ada@example.com");
    expect(getAmbassadorApplication()).toEqual(restored);
  });

  it("reports hasAmbassadorApplication as false before and true after submitting", async () => {
    expect(hasAmbassadorApplication()).toBe(false);
    await ambassadorService.submitApplication(validPayload());
    expect(hasAmbassadorApplication()).toBe(true);
  });

  it("persists an unfinished draft before submission", () => {
    saveApplicationDraft({ fullName: "Ada", email: "ada@example.com" });
    expect(readApplicationDraft<{ fullName: string }>()?.fullName).toBe("Ada");
  });

  it("clears the draft after a successful submission", async () => {
    saveApplicationDraft({ fullName: "Ada", email: "ada@example.com" });
    await ambassadorService.submitApplication(validPayload());
    expect(readApplicationDraft()).toBeNull();
  });

  it("prevents duplicate submissions and returns the existing reference", async () => {
    await ambassadorService.submitApplication(validPayload());

    let duplicate: unknown;
    try {
      await ambassadorService.submitApplication(validPayload());
    } catch (e) {
      duplicate = e;
    }

    expect(duplicate).toBeInstanceOf(AmbassadorSubmissionError);
    expect((duplicate as AmbassadorSubmissionError).code).toBe(AMBASSADOR_ALREADY_APPLIED);
    expect((duplicate as AmbassadorSubmissionError).status).toBe(409);
  });

  it("lets guests submit without any sign-in", async () => {
    const record = await ambassadorService.submitApplication(validPayload());
    expect(record.submittedAt).toBeTruthy();
  });

  it("submits locally without any network call", async () => {
    const fetchSpy = typeof globalThis.fetch === "function"
      ? vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
      : undefined;
    try {
      const record = await ambassadorService.submitApplication(validPayload());
      expect(record.status).toBe("submitted");
    } finally {
      fetchSpy?.mockRestore();
    }
  });

  it("throws a local save error when the device refuses to persist", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    try {
      await expect(ambassadorService.submitApplication(validPayload())).rejects.toBeInstanceOf(
        AmbassadorLocalSaveError
      );
      expect(hasAmbassadorApplication()).toBe(false);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("exposes stored applications through the helper functions", () => {
    saveAmbassadorApplication(validPayload());
    expect(hasAmbassadorApplication()).toBe(true);
    clearAmbassadorApplication();
    expect(hasAmbassadorApplication()).toBe(false);
    expect(getAmbassadorApplication()).toBeNull();
  });
});