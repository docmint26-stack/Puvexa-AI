import { AppShell } from "@/components/app-shell/app-shell";
import { AuthGate, FirstLoginTour } from "@/components/app-shell/auth-gate";
import { GuestAuthModal, GuestUpgradeModal } from "@/components/guest/guest-modals";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <FirstLoginTour>
        <AppShell>{children}</AppShell>
      </FirstLoginTour>
      <GuestUpgradeModal />
      <GuestAuthModal />
    </AuthGate>
  );
}