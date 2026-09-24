import { beforeEach, describe, expect, it } from "vitest";

import {
  AMBASSADOR_ALREADY_APPLIED,
  AMBASSADOR_APPS_KEY,
  AMBASSADOR_DRAFT_KEY,
  AmbassadorSubmissionError,
  type AmbassadorApplicationPayload,
  type CampusAmbassadorApplication,
} from "@/lib/campus-ambassador/types";
import {
  clearApplicationDraft,
  normalizeEmail,
  readApplicationDraft,
  readApplications,
  saveApplicationDraft,
  saveApplications,
} from "@/lib/campus-ambassador/storage";
import { authService, ambassadorService } from "@/lib/services";
import { DEMO_CREDENTIALS } from "@/lib/demo/users";
import { useAuthStore } from "@/lib/state/auth";
import { useGuestStore } from "@/lib/state/guest";

function validPayload(): AmbassadorApplicationPayload {
  return {
    fullName: "Ada Lovelace",
    email: "Ada@Example.com",
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
    linkedinUrl: "",
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

function seedRecord(email: string): CampusAmbassadorApplication {
  const record: CampusAmbassadorApplication = {
    id: "amb_seed",
    applicationId: "AMB-2026-SEED01",
    fullName: "Seed User",
    email: normalizeEmail(email),
    status: "submitted",
    submittedAt: new Date().toISOString(),
    lookupToken: "seed-token-123",
  };
  saveApplications({ [normalizeEmail(email)]: record });
  return record;
}

beforeEach(() => {
  useAuthStore.setState({ user: null, loginAt: null });
  useGuestStore.getState().resetGuest();
  window.localStorage.removeItem(AMBASSADOR_APPS_KEY);
  window.localStorage.removeItem(AMBASSADOR_DRAFT_KEY);
});

describe("ambassador storage helpers", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("round-trips a draft and clears it", () => {
    saveApplicationDraft({ fullName: "Ada", email: "ada@example.com" });
    expect(readApplicationDraft<{ fullName: string }>()?.fullName).toBe("Ada");
    clearApplicationDraft();
    expect(readApplicationDraft()).toBeNull();
  });

  it("returns an empty record set when nothing is stored", () => {
    expect(readApplications()).toEqual({});
  });
});

describe("ambassador service (demo)", () => {
  it("submits a valid application and stores it under the normalized email", async () => {
    const record = await ambassadorService.submitApplication(validPayload());

    expect(record.id).toMatch(/^amb-/);
    expect(record.applicationId).toMatch(/^AMB-\d{4}-[A-Z0-9]{6}$/);
    expect(record.email).toBe("ada@example.com");
    expect(record.status).toBe("submitted");
    expect(record.lookupToken).toBeTruthy();
    expect(readApplications()["ada@example.com"]?.applicationId).toBe(record.applicationId);
  });

  it("rejects a duplicate email with code ALREADY_APPLIED (409)", async () => {
    const payload = validPayload();
    await ambassadorService.submitApplication(payload);

    await expect(ambassadorService.submitApplication(payload)).rejects.toMatchObject({
      code: AMBASSADOR_ALREADY_APPLIED,
      status: 409,
    });
    expect(readApplications()["ada@example.com"]).toBeDefined();
  });

  it("is tolerant of a second email that differs only by case", async () => {
    await ambassadorService.submitApplication(validPayload());
    await expect(
      ambassadorService.submitApplication({ ...validPayload(), email: "ADA@example.com" })
    ).rejects.toBeInstanceOf(AmbassadorSubmissionError);
  });

  it("returns null for the current user when they have not applied", async () => {
    await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    expect(await ambassadorService.getMyApplication()).toBeNull();
  });

  it("returns the current user's application when stored", async () => {
    await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    const seeded = seedRecord(DEMO_CREDENTIALS.email);

    const mine = await ambassadorService.getMyApplication();
    expect(mine?.id).toBe(seeded.id);
    expect(mine?.applicationId).toBe("AMB-2026-SEED01");
  });

  it("returns null for guests", async () => {
    expect(await ambassadorService.getMyApplication()).toBeNull();
  });

  it("looks up an application by its lookup token", async () => {
    const seeded = seedRecord("token@example.com");
    const found = await ambassadorService.getByLookupToken?.("seed-token-123");
    expect(found?.id).toBe(seeded.id);
    expect(await ambassadorService.getByLookupToken?.("nope")).toBeNull();
  });
});