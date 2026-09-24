import type { Metadata } from "next";

import { AmbassadorApplyCta } from "@/components/campus-ambassador/apply-cta";
import { AmbassadorApplicationForm } from "@/components/campus-ambassador/ambassador-application-form";

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
        <div className="mb-10" id="status">
          <AmbassadorApplyCta showOpenCta={false} />
        </div>

        <AmbassadorApplicationForm />
      </div>
    </main>
  );
}