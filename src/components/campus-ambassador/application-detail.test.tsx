import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { ApplicationDetailView } from "./application-detail";
import {
  clearAmbassadorApplication,
  saveAmbassadorApplication,
} from "@/lib/campus-ambassador/local-application";
import type { AmbassadorApplicationPayload } from "@/lib/campus-ambassador/types";

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
    skillTags: ["Community Management", "Content Creation"],
    weeklyHours: 5,
    availabilityMonths: 6,
    timezone: "WAT — Lagos",
    resourcesNeeded: "Event templates and a starter kit.",
    previousAmbassador: false,
    consent: true,
  };
}

afterEach(cleanup);

beforeEach(() => {
  clearAmbassadorApplication();
});

describe("ApplicationDetailView", () => {
  it("shows the empty state with an entry point to apply", async () => {
    render(<ApplicationDetailView />);

    expect(await screen.findByText("No application found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start your application/i })).toBeInTheDocument();
  });

  it("renders the saved application details", async () => {
    saveAmbassadorApplication(payload());

    render(<ApplicationDetailView />);

    expect(await screen.findByText("My application")).toBeInTheDocument();
    expect(screen.getByText(/PCA-\d{4}-[A-Z0-9]{6}/)).toBeInTheDocument();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("University of Lagos")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("Community Management")).toBeInTheDocument();
    expect(screen.getByText("Content Creation")).toBeInTheDocument();
    expect(screen.getByText("WAT — Lagos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explore puvexa/i })).toBeInTheDocument();
  });
});