import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AmbassadorApplyCta } from "./apply-cta";
import {
  AMBASSADOR_APPS_KEY,
  type CampusAmbassadorApplication,
} from "@/lib/campus-ambassador/types";
import { saveApplications } from "@/lib/campus-ambassador/storage";
import { authService } from "@/lib/services";
import { DEMO_CREDENTIALS } from "@/lib/demo/users";
import { useAuthStore } from "@/lib/state/auth";
import { useGuestStore } from "@/lib/state/guest";

afterEach(cleanup);

beforeEach(() => {
  useAuthStore.setState({ user: null, loginAt: null });
  useGuestStore.getState().resetGuest();
  window.localStorage.removeItem(AMBASSADOR_APPS_KEY);
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

  it("shows the submitted status instead of the CTA once applied", async () => {
    const record: CampusAmbassadorApplication = {
      id: "amb_seed",
      applicationId: "AMB-2026-SEED02",
      fullName: "Demo User",
      email: DEMO_CREDENTIALS.email,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      lookupToken: "tok-seed",
    };
    saveApplications({ [DEMO_CREDENTIALS.email]: record });
    await authService.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);

    render(<AmbassadorApplyCta />);

    expect(await screen.findByText("Application submitted")).toBeInTheDocument();
    expect(screen.getByText(/AMB-2026-SEED02/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply now/i })).not.toBeInTheDocument();
  });
});