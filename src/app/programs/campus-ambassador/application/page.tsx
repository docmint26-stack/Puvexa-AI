import type { Metadata } from "next";

import { ApplicationDetailView } from "@/components/campus-ambassador/application-detail";

export const metadata: Metadata = {
  title: "My Application — Campus Ambassador | Puvexa",
  description:
    "Review the campus ambassador application you submitted on this device.",
  robots: { index: false, follow: false },
};

export default function CampusAmbassadorApplicationPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <ApplicationDetailView />
      </div>
    </main>
  );
}