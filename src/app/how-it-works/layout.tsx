import Link from "next/link";
import { Home, LogIn } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid-faint opacity-60" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-linear-to-b from-violet-500/[0.08] to-transparent" />

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Badge variant="outline" className="hidden gap-1 border-primary/30 bg-primary/10 px-2 text-[10px] text-primary sm:inline-flex">
            WORKFLOW
          </Badge>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" render={<Link href="/" />}>
            <Home className="size-4" /> Back home
          </Button>
          <Button size="sm" render={<Link href="/login" />}>
            Sign in <LogIn className="size-4" />
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-[11px] text-muted-foreground sm:px-6">
        Interactive walkthrough · all data is simulated locally in your browser · no real blockchain
      </footer>
    </div>
  );
}