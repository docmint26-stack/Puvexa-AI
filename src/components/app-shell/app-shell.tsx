"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ChevronsLeft,
  ChevronsRight,
  Bell,
  Moon,
  Sun,
  LogOut,
  Settings,
  User,
  Plus,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import { cn } from "cn";

import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/shared/icon";
import { CommandPalette, CommandTriggerButton } from "@/components/app-shell/command-palette";
import { ProductTour } from "@/components/product-tour";
import { WalletConnectButton } from "@/components/web3/connect-wallet-modal";
import { NetworkBadge } from "@/components/web3/network-badge";
import { useTheme } from "@/components/providers";
import { avatarGradient, initialsOf } from "@/lib/format";
import { useCurrentUser, useNotifications } from "@/lib/hooks";
import { useRewardStore } from "@/lib/state/rewards";
import { useAuthActions } from "@/lib/hooks";
import { notify } from "@/lib/feedback";

const MOBILE_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Diagnose", href: "/diagnose", icon: "stethoscope" },
  { label: "Cases", href: "/cases", icon: "files" },
  { label: "AI Lab", href: "/lab", icon: "flask-conical" },
  { label: "Rewards", href: "/rewards", icon: "coins" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const user = useCurrentUser();
  const { logout } = useAuthActions();
  const { items: notifications, unread, markRead, markAllRead } = useNotifications();
  const balance = useRewardStore((s) => s.balance);
  const claimable = useRewardStore((s) => s.claimable);

  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signOut = () => {
    logout();
    notify.info("Signed out", "See you soon — your demo session was cleared.");
    router.push("/");
  };

  const handleNotificationClick = (id: string, href?: string) => {
    markRead(id);
    setDrawerOpen(false);
    if (href) router.push(href);
  };

  const sidebarContent = (
    <SidebarContent
      collapsed={collapsed}
      pathname={pathname}
      user={user}
      claimable={claimable}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="relative min-h-dvh bg-background">
      {/* ambient page background */}
      <div className="pointer-events-none fixed inset-0 bg-grid-faint opacity-60" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-linear-to-b from-primary/[0.07] to-transparent" />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-border/70 bg-sidebar/60 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
          <Link href="/dashboard">
            <Logo size="sm" />
          </Link>
          <Button
            size="icon-sm"
            variant="ghost"
            className={cn("text-muted-foreground", collapsed && "hidden")}
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">{sidebarContent}</div>

        <div className="border-t border-border/70 p-3">
          <div
            className={cn(
              "rounded-xl border border-border/70 bg-card/60 p-3",
              collapsed && "px-1.5 py-3 text-center"
            )}
          >
            {!collapsed ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="coins" className="size-4 text-cyan-300" />
                    <span className="text-xs font-medium text-foreground">
                      {balance.toLocaleString()} FIX
                    </span>
                  </div>
                  {claimable > 0 && (
                    <Badge variant="secondary" className="text-[10px] text-success">
                      {claimable} claimable
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {user ? `Rank #${user.rank || "—"}` : "Not connected"} · Demo / Testnet
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={() => router.push("/rewards")}
                >
                  Claim rewards
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Icon name="coins" className="size-5 text-cyan-300" />
                <span className="text-[10px] font-semibold text-foreground">
                  {balance.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {collapsed && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="mt-2 w-full text-muted-foreground"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <ChevronsRight className="size-4" />
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-sidebar lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
                <Link href="/dashboard" onClick={() => setDrawerOpen(false)}>
                  <Logo size="sm" />
                </Link>
                <Button size="icon-sm" variant="ghost" onClick={() => setDrawerOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
                <SidebarContent
                  collapsed={false}
                  pathname={pathname}
                  user={user}
                  claimable={claimable}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </div>
              <div className="border-t border-border/70 p-3">
                <Button size="sm" variant="secondary" className="w-full" onClick={() => router.push("/rewards")}>
                  <Icon name="coins" className="size-3.5" /> {balance.toLocaleString()} FIX · Claimable {claimable}
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div
        className={cn(
          "relative flex min-h-dvh flex-col transition-all duration-300",
          collapsed ? "lg:pl-[76px]" : "lg:pl-64"
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" className="size-4" />
          </Button>

          <div className="lg:hidden">
            <Link href="/dashboard">
              <Logo size="xs" />
            </Link>
          </div>

          <CommandTriggerButton />
          <div className="flex-1" />

          <div className="hidden sm:block">
            <NetworkBadge />
          </div>

          <Button size="sm" className="hidden sm:inline-flex" onClick={() => router.push("/diagnose")}>
            <Plus className="size-4" />
            New Diagnosis
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground sm:hidden"
            onClick={() => router.push("/diagnose")}
            aria-label="New diagnosis"
          >
            <Plus className="size-4" />
          </Button>

          <div className="hidden md:block">
            <WalletConnectButton />
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="icon" variant="ghost" className="relative text-muted-foreground" />}
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[340px] p-2" align="end" sideOffset={8}>
              <div className="flex items-center justify-between px-2 pb-1.5">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <Button size="xs" variant="ghost" className="gap-1 text-muted-foreground" onClick={markAllRead}>
                  <CheckCheck className="size-3" /> Mark all read
                </Button>
              </div>
              <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 && (
                  <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                    You&apos;re all caught up.
                  </p>
                )}
                {notifications.slice(0, 6).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.actionHref)}
                    className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent/60"
                  >
                    <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card">
                      <Icon
                        name={n.kind === "reward" ? "coins" : n.kind === "case" ? "files" : "sparkles"}
                        className={cn(
                          "size-3.5",
                          n.kind === "reward" && "text-cyan-300",
                          n.kind === "case" && "text-violet-300",
                          n.kind === "system" && "text-muted-foreground"
                        )}
                      />
                      {n.unread && (
                        <span className="absolute right-0 top-0 size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-foreground">{n.title}</span>
                      <span className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{n.time}</span>
                    </span>
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 pt-1">
                <Button
                  size="xs"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push("/notifications");
                  }}
                >
                  View all activity
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon" variant="ghost" className="rounded-full" />}>
              <Avatar size="default" className="size-8">
                <AvatarFallback className={cn("bg-linear-to-br text-white", avatarGradient(user?.handle ?? "a"))}>
                  {user ? initialsOf(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-56">
              <DropdownMenuLabel>
                {user && (
                  <>
                    <p className="text-sm font-semibold text-foreground">{user.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user.handle}</p>
                    <p className="mt-1 text-[10px] font-normal text-muted-foreground/80">
                      {user.level} · {user.reputation.toLocaleString()} reputation
                    </p>
                  </>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/rewards")}>
                  <Sparkles className="size-4" />
                  Rewards
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={signOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("grid size-7 place-items-center rounded-full", active && "bg-primary/15")}>
                    <Icon name={item.icon} className="size-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <ProductTour />
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  user,
  claimable,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  user: ReturnType<typeof useCurrentUser>;
  claimable: number;
  onNavigate: () => void;
}) {
  return (
    <>
      <nav className="space-y-1">
        <Link
          href="/diagnose"
          onClick={onNavigate}
          className={cn(
            buttonVariants({ size: "sm", variant: "default" }),
            "w-full justify-start gap-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Plus className="size-4 shrink-0" />
          {!collapsed && "New Diagnosis"}
        </Link>
      </nav>

      <nav className="mt-4 space-y-1">
        <p
          className={cn(
            "mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
            collapsed && "hidden"
          )}
        >
          Workspace
        </p>
        <SidebarLink collapsed={collapsed} label="Dashboard" href="/dashboard" icon="layout-dashboard" pathname={pathname} onNavigate={onNavigate} />
        <SidebarLink collapsed={collapsed} label="New Diagnosis" href="/diagnose" icon="stethoscope" pathname={pathname} onNavigate={onNavigate} activeOn="/diagnose" />
        <SidebarLink collapsed={collapsed} label="My Cases" href="/cases" icon="files" pathname={pathname} onNavigate={onNavigate} />
        <SidebarLink collapsed={collapsed} label="Contribute" href="/contribute" icon="sparkles" pathname={pathname} onNavigate={onNavigate} />
        <SidebarLink collapsed={collapsed} label="AI Lab" href="/lab" icon="flask-conical" pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <Separator className="my-4" />

      <nav className="space-y-1">
        <p
          className={cn(
            "mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
            collapsed && "hidden"
          )}
        >
          Economy
        </p>
        <SidebarLink collapsed={collapsed} label="Rewards" href="/rewards" icon="coins" pathname={pathname} onNavigate={onNavigate} />
        <SidebarLink collapsed={collapsed} label="Leaderboard" href="/leaderboard" icon="trophy" pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <Separator className="my-4" />

      <nav className="space-y-1">
        <SidebarLink collapsed={collapsed} label="Profile" href="/profile" icon="user" pathname={pathname} onNavigate={onNavigate} />
        <SidebarLink collapsed={collapsed} label="Settings" href="/settings" icon="settings" pathname={pathname} onNavigate={onNavigate} />
      </nav>

      {claimable > 0 && !collapsed && (
        <div className="mt-4 rounded-xl border border-success/20 bg-success/5 p-3">
          <div className="flex items-center gap-2">
            <Icon name="wallet" className="size-4 text-success" />
            <p className="text-xs font-medium text-foreground">{claimable} FIX ready to claim</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {user ? `${user.name.split(" ")[0]}'s` : "Your"} verified rewards unlocked.
          </p>
        </div>
      )}
    </>
  );
}

function SidebarLink({
  collapsed,
  label,
  href,
  icon,
  pathname,
  onNavigate,
  activeOn,
}: {
  collapsed: boolean;
  label: string;
  href: string;
  icon: string;
  pathname: string;
  onNavigate: () => void;
  activeOn?: string;
}) {
  const active = pathname.startsWith(activeOn ?? href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
        active && "bg-accent/80 text-foreground",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute left-0 h-4 w-0.5 rounded-full bg-linear-to-b from-violet-400 to-cyan-400"
        />
      )}
      <Icon name={icon} className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}