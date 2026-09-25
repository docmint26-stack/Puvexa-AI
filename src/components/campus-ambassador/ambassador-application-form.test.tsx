import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredAmbassadorApplication } from "@/lib/campus-ambassador/types";
import { AmbassadorLocalSaveError } from "@/lib/campus-ambassador/local-application";

const { submitMock } = vi.hoisted(() => ({ submitMock: vi.fn() }));

vi.mock("@/lib/services", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/services")>();
  return {
    ...mod,
    ambassadorService: {
      ...mod.ambassadorService,
      submitApplication: submitMock,
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const walkOptions = (node: unknown, acc: { value: string; label: string }[]) => {
    if (React.isValidElement(node)) {
      const props = (node.props ?? {}) as { value?: unknown; children?: unknown };
      if (typeof props.value === "string" && props.value) {
        acc.push({ value: props.value, label: String(props.children ?? props.value) });
      }
      React.Children.forEach(props.children as React.ReactNode, (child) => walkOptions(child, acc));
    }
    return acc;
  };
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(children, (child) => walkOptions(child, options));
    return (
      <select
        aria-label="select"
        data-testid="select"
        value={value ?? ""}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };
  return {
    Select,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => children ?? null,
    SelectItem: ({ children }: { children: React.ReactNode }) => children ?? null,
  };
});

import { AmbassadorApplicationForm } from "./ambassador-application-form";
import { clearAmbassadorApplication } from "@/lib/campus-ambassador/local-application";

const formValues = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  country: "Nigeria",
  institution: "University of Lagos",
  program: "BSc Computer Science",
  graduationYear: 2027,
  motivation:
    "I love helping classmates debug their projects and want to grow a fix-first community on my campus.",
  communityGoals:
    "I want to host monthly problem-solving workshops and make verified fixes a habit in my CS club.",
  technicalLevel: "advanced",
  skillTags: ["Community Management"],
  timezone: "WAT — Lagos",
  resourcesNeeded: "Event templates and a starter kit for the first workshop.",
} as const;

function storedRecord(): StoredAmbassadorApplication {
  return {
    id: "PCA-2026-AB12CD",
    applicationId: "PCA-2026-AB12CD",
    status: "submitted",
    fullName: formValues.fullName,
    email: formValues.email,
    submittedAt: "2026-09-24T10:30:00.000Z",
    details: {
      fullName: formValues.fullName,
      email: formValues.email,
      country: formValues.country,
      institution: formValues.institution,
      program: formValues.program,
      graduationYear: formValues.graduationYear,
      currentStudent: true,
      leadershipExperience: false,
      motivation: formValues.motivation,
      communityGoals: formValues.communityGoals,
      technicalLevel: formValues.technicalLevel,
      skillTags: [...formValues.skillTags],
      weeklyHours: 5,
      availabilityMonths: 6,
      timezone: formValues.timezone,
      resourcesNeeded: formValues.resourcesNeeded,
      previousAmbassador: false,
      consent: true,
    },
  };
}

afterEach(cleanup);

beforeEach(() => {
  clearAmbassadorApplication();
  submitMock.mockReset();
});

async function completeApplication() {
  render(<AmbassadorApplicationForm />);

  await screen.findByLabelText(/Full name/);
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: formValues.fullName } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: formValues.email } });
  fireEvent.change(screen.getByLabelText(/Country/), { target: { value: formValues.country } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByLabelText(/Institution/);
  fireEvent.change(screen.getByLabelText(/Institution/), { target: { value: formValues.institution } });
  fireEvent.change(screen.getByLabelText(/Degree/), { target: { value: formValues.program } });
  fireEvent.change(screen.getByLabelText(/graduation year/i), {
    target: { value: String(formValues.graduationYear) },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByLabelText(/Why do you want to become/i);
  fireEvent.change(screen.getByLabelText(/Why do you want to become/i), {
    target: { value: formValues.motivation },
  });
  fireEvent.change(screen.getByLabelText(/What would you change/i), {
    target: { value: formValues.communityGoals },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByText(/These are optional/);
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByTestId("select");
  fireEvent.change(screen.getByTestId("select"), { target: { value: formValues.technicalLevel } });
  fireEvent.click(screen.getByRole("button", { name: /^Community Management$/ }));
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByLabelText(/support would help/i);
  fireEvent.change(screen.getByTestId("select"), { target: { value: formValues.timezone } });
  fireEvent.change(screen.getByLabelText(/support would help/i), {
    target: { value: formValues.resourcesNeeded },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByRole("checkbox", { name: /I agree to the program terms/i });
  fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the program terms/i }));
  fireEvent.click(screen.getByRole("button", { name: /^Submit application$/ }));
}

describe("AmbassadorApplicationForm", () => {
  it(
    "submits the whole flow locally and shows the success screen without backend errors",
    async () => {
      let resolveSubmit!: (value: StoredAmbassadorApplication) => void;
      submitMock.mockImplementation(
        () => new Promise<StoredAmbassadorApplication>((resolve) => { resolveSubmit = resolve; })
      );

      await completeApplication();

      expect(submitMock).not.toHaveBeenCalled();
      expect(await screen.findByText(/Submitting application/)).toBeInTheDocument();
      expect(submitMock).toHaveBeenCalledTimes(1);

      resolveSubmit(storedRecord());
      expect(await screen.findByText("Application Submitted Successfully")).toBeInTheDocument();

      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: formValues.fullName,
          email: formValues.email,
          country: formValues.country,
          institution: formValues.institution,
          program: formValues.program,
          graduationYear: formValues.graduationYear,
          motivation: formValues.motivation,
          communityGoals: formValues.communityGoals,
          technicalLevel: "advanced",
          skillTags: ["Community Management"],
          weeklyHours: 5,
          availabilityMonths: 6,
          timezone: "WAT — Lagos",
          resourcesNeeded: formValues.resourcesNeeded,
          consent: true,
        })
      );

      expect(screen.queryByText(/Submission blocked/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Could not reach the Puvexa API/i)).not.toBeInTheDocument();
    },
    20000
  );

  it(
    "surfaces a local-only message when the device refuses to persist the application",
    async () => {
      submitMock.mockRejectedValue(new AmbassadorLocalSaveError());

      await completeApplication();

      expect(
        await screen.findByText("We couldn't save your application on this device. Please try again.")
      ).toBeInTheDocument();
      expect(screen.getByText("Review & submit")).toBeInTheDocument();
      expect(screen.queryByText("Application Submitted Successfully")).not.toBeInTheDocument();
      expect(screen.queryByText(/Submission blocked/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Could not reach the Puvexa API/i)).not.toBeInTheDocument();
    },
    20000
  );
});