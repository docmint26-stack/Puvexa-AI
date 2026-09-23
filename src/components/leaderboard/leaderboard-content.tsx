import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaderboard } from "@/lib/demo/leaderboard";
import { avatarGradient } from "@/lib/format";

const topFive = [...leaderboard]
  .sort((a, b) => b.reputation - a.reputation)
  .slice(0, 5);

export function LeaderboardContent() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Trophy className="size-3.5" /> Community leaderboard
        </span>
        <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Top 5 problem solvers</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Every great fix starts with someone like you. Explore Puvexa, share what works, and build your reputation.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Demo data: sample users and reputation points, not live rankings or token rewards.</p>
      </div>

      <ol aria-label="Top five users ranked by demo points" className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 divide-y divide-border/60">
        {topFive.map((entry, index) => (
          <li key={entry.handle} className={`flex items-center gap-3 px-4 py-5 sm:gap-4 sm:px-6 ${index === 0 ? "bg-primary/10" : ""}`}>
            <span className="w-6 shrink-0 text-center font-heading text-lg font-bold text-muted-foreground">{index + 1}</span>
            <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br text-xs font-semibold text-white ${avatarGradient(entry.handle)}`}>
              {entry.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{entry.name}</p>
              <p className="truncate text-xs text-muted-foreground">{entry.handle}</p>
            </div>
            {index === 0 && <Trophy aria-label="First place" className="hidden size-5 text-amber-300 sm:block" />}
            <div className="shrink-0 text-right">
              <p className="font-heading text-lg font-bold text-primary sm:text-xl">{entry.reputation.toLocaleString("en-US")}</p>
              <p className="text-xs text-muted-foreground">points</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <h3 className="font-heading text-xl font-semibold">Your next fix could inspire someone.</h3>
        <p className="mt-2 text-sm text-muted-foreground">Start solving with Puvexa and help the community learn from your experience.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button render={<Link href="/signup" />}>Join Puvexa <ArrowRight className="size-4" /></Button>
          <Button variant="outline" render={<Link href="/how-it-works" />}>Explore the workflow</Button>
        </div>
      </div>
    </div>
  );
}
