import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";

export const metadata = { title: "Community leaderboard" };

export default function LeaderboardPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><Logo size="sm" /></Link>
          <div className="flex gap-2">
            <Button variant="ghost" render={<Link href="/" />}>Home</Button>
            <Button variant="outline" render={<Link href="/dashboard" />}>Dashboard</Button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="sr-only">Puvexa leaderboard</h1>
        <LeaderboardContent />
      </main>
    </div>
  );
}
