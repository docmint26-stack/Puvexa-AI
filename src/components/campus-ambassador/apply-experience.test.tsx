import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AmbassadorApplicationPayload } from "@/lib/campus-ambassador/types";
import {
  clearAmbassadorApplication,
  saveAmbassadorApplication,
} from "@/lib/campus-ambassador/local-application";

vi.mock("./ambassador-application-form", () => ({
  AmbassadorApplicationForm: () => <div data-testid="ambassador-form">Campus Ambassador form</div>,
}));

import { AmbassadorApplyExperience } from "./apply-experience";

function payload(): AmbassadorApplicationPayload {
  return {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    country: "Nigeria",
    institution: "University of Lagos",
    program: "BSc Computer Science",
    graduationYear: 2027,
    currentStudent: true,
    leadershipExperience: false,
    motivation: "I love helping classmates debug their projects and want to grow a fix-first community on campus.",
    communityGoals: "I want to host monthly problem-solving workshops and make verified fixes a habit in my CS club.",
    technicalLevel: "intermediate",
    skillTags: ["Community Management"],
    weeklyHours: 5,
    availabilityMonths: 6,
    timezone: "WAT — Lagos",
    resourcesNeeded: "Event templates and a starter kit for the first workshop.",
    previousAmbassador: false,
    consent: true,
  };
}

afterEach(cleanup);

beforeEach(() => {
  clearAmbassadorApplication();
});

describe("AmbassadorApplyExperience", () => {
  it("shows the application form when nothing has been submitted yet", async () => {
    render(<AmbassadorApplyExperience />);
    expect(await screen.findByTestId("ambassador-form")).toBeInTheDocument();
  });

  it("shows the already-applied view once an application is saved", async () => {
    saveAmbassadorApplication(payload());

    render(<AmbassadorApplyExperience />);

    expect(await screen.findByText("You've already applied")).toBeInTheDocument();
    expect(screen.getByText(/PCA-\d{4}-[A-Z0-9]{6}/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view application/i })).toBeInTheDocument();
  });
});