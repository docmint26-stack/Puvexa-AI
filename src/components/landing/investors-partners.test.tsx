import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvestorsAndPartnersSection } from "./landing-page";
import { investorsAndPartners } from "@/lib/data";

vi.mock("@/components/shared/motion", () => ({
  Reveal: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

afterEach(cleanup);

describe("InvestorsAndPartnersSection", () => {
  it("keeps the investors & partners claim copy", () => {
    render(<InvestorsAndPartnersSection />);

    expect(screen.getByText("Investors & partners")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backed by builders across the ecosystem" })).toBeInTheDocument();
    expect(
      screen.getByText("Working with investors, launchpads, and ecosystem partners who believe verified help should compound.")
    ).toBeInTheDocument();
  });

  it("lists every required partner exactly once", () => {
    render(<InvestorsAndPartnersSection />);

    expect(investorsAndPartners).toHaveLength(13);
    const ids = investorsAndPartners.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const partner of investorsAndPartners) {
      expect(screen.getAllByRole("link", { name: `Visit ${partner.name} website` })).toHaveLength(1);
    }
    expect(screen.getAllByRole("link")).toHaveLength(investorsAndPartners.length);
  });

  it("links every card to the official site in a new tab", () => {
    render(<InvestorsAndPartnersSection />);

    for (const partner of investorsAndPartners) {
      const link = screen.getByRole("link", { name: `Visit ${partner.name} website` });
      expect(link).toHaveAttribute("href", partner.website);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("renders each official logo with descriptive alt text", () => {
    render(<InvestorsAndPartnersSection />);

    for (const partner of investorsAndPartners) {
      const logo = screen.getByRole("img", { name: `${partner.name} logo` });
      expect(logo).toHaveAttribute("src", partner.logo);
      expect(partner.logo.startsWith("/partners/")).toBe(true);
    }
  });

  it("ships every referenced logo file in public/partners", () => {
    const dir = path.join(process.cwd(), "public", "partners");

    for (const partner of investorsAndPartners) {
      const file = path.join(dir, path.basename(partner.logo));
      expect(fs.existsSync(file), `${partner.logo} is missing from public/partners`).toBe(true);
    }
  });
});
