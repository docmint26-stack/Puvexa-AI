import { beforeEach, expect, it, vi } from "vitest";
import { apiGet, apiPost } from "./client";
import { apiAmbassadorService } from "./ambassador";
import { ApiError } from "./client";

vi.mock("./supabase", () => ({ getAccessToken: vi.fn().mockResolvedValue("test-token") }));
vi.mock("./client", async original => ({ ...await original<typeof import("./client")>(), apiGet: vi.fn(), apiPost: vi.fn() }));

const payload = {
  fullName: "Amina Diallo",
  email: "amina@example.edu",
  country: "Senegal",
  institution: "ESTI University",
  program: "Computer Science",
  graduationYear: 2027,
  currentStudent: true,
  leadershipExperience: false,
  motivation: "I believe Puvexa can help thousands of students on my campus.",
  communityGoals: "I want to run workshops that teach students how to diagnose their own devices.",
  technicalLevel: "intermediate" as const,
  skillTags: ["Community Management", "Technical Writing"],
  weeklyHours: 5,
  availabilityMonths: 6,
  timezone: "Africa/Dakar",
  resourcesNeeded: "Poster templates and a small budget for a launch event.",
  previousAmbassador: false,
  consent: true,
};

const created = {
  id: "amb-1",
  applicationId: "AMB-2026-1a2b3c",
  fullName: payload.fullName,
  email: payload.email,
  status: "submitted",
  submittedAt: "2026-09-24T12:00:00Z",
  lookupToken: "tok-xyz",
};

beforeEach(() => vi.clearAllMocks());

it("submits the payload to the backend as snake_case", async () => {
  vi.mocked(apiPost).mockResolvedValue(created);
  const result = await apiAmbassadorService.submitApplication(payload);

  expect(result.applicationId).toBe("AMB-2026-1a2b3c");
  expect(apiPost).toHaveBeenCalledTimes(1);
  const [path, body] = vi.mocked(apiPost).mock.calls[0];
  expect(path).toBe("/api/v1/programs/campus-ambassador/applications");
  expect(body).toMatchObject({
    full_name: payload.fullName,
    graduation_year: payload.graduationYear,
    current_student: payload.currentStudent,
    leadership_experience: payload.leadershipExperience,
    community_goals: payload.communityGoals,
    technical_level: payload.technicalLevel,
    skill_tags: payload.skillTags,
    weekly_hours: payload.weeklyHours,
    availability_months: payload.availabilityMonths,
    resources_needed: payload.resourcesNeeded,
    previous_ambassador: payload.previousAmbassador,
    consent: true,
  });
  expect(body).not.toHaveProperty("fullName");
  expect(body).not.toHaveProperty("graduationYear");
});

it("throws AmbassadorSubmissionError on a 409 duplicate email", async () => {
  vi.mocked(apiPost).mockRejectedValue({ status: 409, code: "ALREADY_APPLIED", details: {} });
  await expect(apiAmbassadorService.submitApplication(payload)).rejects.toMatchObject({
    code: "ALREADY_APPLIED",
    status: 409,
  });
});

it("returns null for a missing personal application", async () => {
  vi.mocked(apiGet).mockRejectedValue(new ApiError(404, "NOT_FOUND", "No application for this user."));
  expect(await apiAmbassadorService.getMyApplication()).toBeNull();
});

it("looks an application up by its server-issued token", async () => {
  vi.mocked(apiGet).mockResolvedValue(created);
  const result = await apiAmbassadorService.getByLookupToken?.("tok-xyz");
  expect(result?.email).toBe(payload.email);
  expect(apiGet).toHaveBeenCalledWith("/api/v1/programs/campus-ambassador/applications/lookup?token=tok-xyz");
});