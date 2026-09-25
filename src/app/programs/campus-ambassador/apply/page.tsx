import type { Metadata } from "next";

import { AmbassadorApplyExperience } from "@/components/campus-ambassador/apply-experience";

export const metadata: Metadata = {
  title: "Apply — Campus Ambassador | Puvexa",
  description:
    "Apply to become a Puvexa Campus Ambassador. A volunteer leadership program that gives you first experience in developer communities, open source, and event operations.",
  robots: { index: true, follow: false },
};

export default function CampusAmbassadorApplyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <AmbassadorApplyExperience />
      </div>
    </main>
  );
}