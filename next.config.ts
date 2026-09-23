import type { NextConfig } from "next";

/** /demo was renamed to /how-it-works with a permanent redirect. */
export const demoRedirect = {
  source: "/demo",
  destination: "/how-it-works",
  permanent: true,
};

const nextConfig: NextConfig = {
  redirects: async () => [demoRedirect],
};

export default nextConfig;