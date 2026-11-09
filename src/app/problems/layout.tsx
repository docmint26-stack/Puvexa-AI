import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProblemsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid-faint opacity-60" />

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Badge variant="outline" className="hidden gap-1 border-primary/30 bg-primary/10 px-2 text-[10px] text-primary sm:inline-flex">
            PROBLEMS
          </Badge>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" render={<Link href="/" />}>
            Home
          </Button>
          <Button size="sm" render={<Link href="/dashboard" />}>
            <LayoutDashboard className="size-4" /> Dashboard
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>

      <footer className="relative mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-[11px] text-muted-foreground sm:px-6">
        Curated discovery library — outcomes are recorded only from real diagnoses.
      </footer>
    </div>
  );
}
