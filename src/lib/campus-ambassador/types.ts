export const AMBASSADOR_TECHNICAL_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "professional",
] as const;
export type AmbassadorTechnicalLevel = (typeof AMBASSADOR_TECHNICAL_LEVELS)[number];

export const AMBASSADOR_STATUSES = [
  "submitted",
  "under_review",
  "shortlisted",
  "accepted",
  "rejected",
] as const;
export type AmbassadorApplicationStatus = (typeof AMBASSADOR_STATUSES)[number];

export const AMBASSADOR_SKILL_TAGS = [
  "AI & Machine Learning",
  "Web Development",
  "Mobile Apps",
  "Cloud & DevOps",
  "Cybersecurity",
  "Data Science",
  "Technical Writing",
  "Community Management",
  "Content Creation",
  "Event Planning",
  "UI/UX Design",
  "Open Source",
  "QA & Testing",
  "Technical Support",
] as const;
export type AmbassadorSkillTag = (typeof AMBASSADOR_SKILL_TAGS)[number];

export interface AmbassadorApplicationPayload {
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  city?: string;
  institution: string;
  program: string;
  graduationYear: number;
  currentStudent: boolean;
  clubInvolvement?: string;
  leadershipExperience: boolean;
  leadershipDescription?: string;
  motivation: string;
  communityGoals: string;
  githubUrl?: string;
  linkedinUrl?: string;
  otherSocialUrl?: string;
  audienceCount?: number;
  technicalLevel: AmbassadorTechnicalLevel;
  skillTags: string[];
  weeklyHours: number;
  availabilityMonths: number;
  timezone: string;
  resourcesNeeded: string;
  previousAmbassador: boolean;
  previousAmbassadorDetails?: string;
  consent: boolean;
}

export interface CampusAmbassadorApplication {
  id: string;
  applicationId: string;
  fullName: string;
  email: string;
  status: AmbassadorApplicationStatus;
  submittedAt: string;
  /** Server-issued token used by guests to look their application up later. */
  lookupToken?: string;
}

export interface AmbassadorService {
  submitApplication(payload: AmbassadorApplicationPayload): Promise<CampusAmbassadorApplication>;
  getMyApplication(): Promise<CampusAmbassadorApplication | null>;
  getByLookupToken?(token: string): Promise<CampusAmbassadorApplication | null>;
}

/** Thrown by the demo/API layer when an applicant already submitted an application. */
export class AmbassadorSubmissionError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AmbassadorSubmissionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const AMBASSADOR_ALREADY_APPLIED = "ALREADY_APPLIED";
export const AMBASSADOR_DRAFT_KEY = "puvexa:amb:draft";
export const AMBASSADOR_APPS_KEY = "puvexa:amb:applications";