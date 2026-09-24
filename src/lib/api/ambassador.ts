import { apiGet, apiPost, ApiError } from "@/lib/api/client";
import {
  AMBASSADOR_ALREADY_APPLIED,
  AmbassadorSubmissionError,
  type AmbassadorApplicationPayload,
  type AmbassadorService,
  type CampusAmbassadorApplication,
} from "@/lib/campus-ambassador/types";

const BASE = "/api/v1/programs/campus-ambassador/applications";

function toBackendCreatePayload(payload: AmbassadorApplicationPayload): Record<string, unknown> {
  return {
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    country: payload.country,
    city: payload.city,
    institution: payload.institution,
    program: payload.program,
    graduation_year: payload.graduationYear,
    current_student: payload.currentStudent,
    club_involvement: payload.clubInvolvement,
    leadership_experience: payload.leadershipExperience,
    leadership_description: payload.leadershipDescription,
    motivation: payload.motivation,
    community_goals: payload.communityGoals,
    github_url: payload.githubUrl,
    linkedin_url: payload.linkedinUrl,
    other_social_url: payload.otherSocialUrl,
    audience_count: payload.audienceCount,
    technical_level: payload.technicalLevel,
    skill_tags: payload.skillTags,
    weekly_hours: payload.weeklyHours,
    availability_months: payload.availabilityMonths,
    timezone: payload.timezone,
    resources_needed: payload.resourcesNeeded,
    previous_ambassador: payload.previousAmbassador,
    previous_ambassador_details: payload.previousAmbassadorDetails,
    consent: payload.consent,
  };
}

function toSubmissionError(err: unknown): unknown {
  if (err instanceof ApiError) {
    // The backend reports duplicate applications with a 409 + code.
    if (err.status === 409 || err.code === AMBASSADOR_ALREADY_APPLIED) {
      return new AmbassadorSubmissionError(
        AMBASSADOR_ALREADY_APPLIED,
        "You already submitted an application for this email.",
        409,
        err.details
      );
    }
  }
  return err;
}

export const apiAmbassadorService: AmbassadorService = {
  async submitApplication(payload: AmbassadorApplicationPayload): Promise<CampusAmbassadorApplication> {
    try {
      return await apiPost<CampusAmbassadorApplication>(BASE, toBackendCreatePayload(payload));
    } catch (err) {
      throw toSubmissionError(err);
    }
  },

  async getMyApplication(): Promise<CampusAmbassadorApplication | null> {
    try {
      return await apiGet<CampusAmbassadorApplication>(`${BASE}/my-application`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  async getByLookupToken(token: string): Promise<CampusAmbassadorApplication | null> {
    try {
      return await apiGet<CampusAmbassadorApplication>(`${BASE}/lookup?token=${encodeURIComponent(token)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
};