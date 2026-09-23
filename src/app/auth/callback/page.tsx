import { AuthCallbackHandler } from "@/components/auth/auth-callback-handler";

export default function AuthCallbackPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-grid-faint opacity-60" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-linear-to-b from-primary/10 to-transparent" />
      <div className="relative w-full max-w-5xl">
        <AuthCallbackHandler />
      </div>
    </div>
  );
}