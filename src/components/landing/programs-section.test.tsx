import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProgramsSection } from "./programs-section";
import {
  AMBASSADOR_APPS_KEY,
  type CampusAmbassadorApplication,
} from "@/lib/campus-ambassador/types";
import { saveApplications } from "@/lib/campus-ambassador/storage";
import { authService } from "@/lib/services";
import { DEMO_CREDENTIALS } from "@/lib/demo/users";
import { useAuthStore } from "@/lib/state/auth";
import { useGuestStore } from "@/lib/state/guest";

vi.mock("@/components/shared/motion", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

beforeEach(() => {
  useAuthStore.setState({ user: null, loginAt: null });
  useGuestStore.getState().resetGuest();
  window.localStorage.removeItem(AMBASSADOR_APPS_KEY);
});

describe("ProgramsSection", () => {
  it("shows applications open and an apply CTA for guests", async () => {
    render(<ProgramsSection />);
    expect((await screen.findAllByText("Applications open")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /apply now/i })).toBeInTheDocument();
  });

  it("shows Application submitted once the visitor has applied", async () => {
    const record: CampusAmbassadorApplication = {
      id: "amb_seed",
      applicationId: "AMB-2026-SEED03",
      fullName: "Demo User",
      email: DEMO_CREDENTIALS.email,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      lookupToken: "tok-seed",
    };
    saveApplications({ [DEMO_CREDENTIALS.email]: record });
    await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);

    render(<ProgramsSection />);

    expect(await screen.findByText("Application submitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view application/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply now/i })).not.toBeInTheDocument();
  });
});