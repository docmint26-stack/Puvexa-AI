import { describe, expect, it } from "vitest";

import { demoRedirect } from "../../next.config";

describe("next.config demo redirect", () => {
  it("permanently maps /demo to the How Puvexa Works walkthrough", () => {
    expect(demoRedirect).toEqual({
      source: "/demo",
      destination: "/how-it-works",
      permanent: true,
    });
  });
});