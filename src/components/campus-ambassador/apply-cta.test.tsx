import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AmbassadorApplyCta } from "./apply-cta";
import type { AmbassadorApplicationPayload } from "@/lib/campus-ambassador/types";
import {
  clearAmbassadorApplication,
  saveAmbassadorApplication,
} from "@/lib/campus-ambassador/local-application";

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

describe("AmbassadorApplyCta", () => {
  it("shows a call to action when open", async () => {
    render(<AmbassadorApplyCta />);
    expect(await screen.findByText("Ready to build your first tech community?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply now/i })).toBeInTheDocument();
  });

  it("renders nothing when closed and the user has not applied", async () => {
    const { container } = render(<AmbassadorApplyCta showOpenCta={false} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("shows the already-applied state instead of the CTA once submitted", async () => {
    saveAmbassadorApplication(payload());

    render(<AmbassadorApplyCta />);

    expect(await screen.findByText("You've already applied")).toBeInTheDocument();
    expect(screen.getByText(/PCA-\d{4}-/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view application/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply now/i })).not.toBeInTheDocument();
  });
});