// Centralized demo dataset + shared types.
// Every demo-backed screen consumes this layer (via hooks/services).
// Later phases swap in real API services without touching components.
export * from "./demo/types";
export * from "./demo/users";
export * from "./demo/cases";
export * from "./demo/rewards";
export * from "./demo/leaderboard";
export * from "./demo/notifications";
export * from "./demo/contributions";
export * from "./demo/marketing";
export * from "./demo/dashboard";
export * from "./demo/help";
export * from "./demo/search";
export * from "./data/top-problems";
export * from "./data/programs";

export const APP_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "New Diagnosis", href: "/diagnose", icon: "stethoscope" },
  { label: "My Cases", href: "/cases", icon: "files" },
  { label: "Contribute", href: "/contribute", icon: "sparkles" },
  { label: "Rewards", href: "/rewards", icon: "coins" },
  { label: "Leaderboard", href: "/leaderboard", icon: "trophy" },
  { label: "Profile", href: "/profile", icon: "user" },
] as const;

export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

export const ROUTE_DIAGNOSE = "/diagnose";