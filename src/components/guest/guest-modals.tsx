"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LogIn, Sparkles, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGuestStore } from "@/lib/state/guest";

/**
 * "Keep your guest progress?" — shown right after a guest signs up or logs in.
 * The user can carry their journey over or start the account completely fresh.
 */
export function GuestUpgradeModal() {
  const pendingUpgrade = useGuestStore((s) => s.pendingUpgrade);
  const mode = useGuestStore((s) => s.mode);
  const transferGuestProgress = useGuestStore((s) => s.transferGuestProgress);
  const clearGuestProgress = useGuestStore((s) => s.clearGuestProgress);
  const setPendingUpgrade = useGuestStore((s) => s.setPendingUpgrade);

  const open = pendingUpgrade && mode === "authenticated";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPendingUpgrade(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Sparkles className="size-5 text-primary" />
          </AlertDialogMedia>
          <AlertDialogTitle>Keep your guest progress?</AlertDialogTitle>
          <AlertDialogDescription>
            You explored Puvexa as a guest. Want to carry your journey into this
            account? Guest Points stay a preview — they are never converted to FIX.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => clearGuestProgress()}>
            Start fresh
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => transferGuestProgress()}>
            Transfer progress <ArrowRight className="size-3.5" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * "Create an account to continue" — raised from any screen when a guest tries an
 * action that requires an account (claiming, staking, final contribution submit).
 */
export function GuestAuthModal() {
  const gate = useGuestStore((s) => s.gate);
  const closeAuthGate = useGuestStore((s) => s.closeAuthGate);
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  return (
    <Dialog open={gate.open} onOpenChange={(o) => !o && closeAuthGate()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" /> Create an account to continue
          </DialogTitle>
          <DialogDescription>
            {gate.message ??
              "Create a free account to unlock this action and keep your work."}
            {" "}Signing up is free and keeps everything you explored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Button size="lg" className="w-full" render={<Link href={`/signup?next=${next}`} />}>
            Create free account <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            render={<Link href={`/login?next=${next}`} />}
          >
            <LogIn className="size-4" /> I already have an account
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={closeAuthGate}>
            Keep exploring as guest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}