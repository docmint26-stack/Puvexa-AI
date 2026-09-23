import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";import { ApiError } from "@/lib/api/client";let client: SupabaseClient | null | undefined;let unauthUser: User | null | undefined;export function getSupabaseClient(): SupabaseClient | null {  if (client !== undefined) return client;  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();  if (!url || !key) {    client = null;    return null;  }  client = createClient(url, key, {    auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce" },  });  return client;}export function isSupabaseConfigured(): boolean {  return getSupabaseClient() !== null;}export async function getAccessToken(): Promise<string | null> {  const supabase = getSupabaseClient();  if (!supabase) return null;  const { data } = await supabase.auth.getSession();  return data.session?.access_token ?? null;}export async function getSessionUser(): Promise<User | null> {  const supabase = getSupabaseClient();  if (!supabase) return null;  const { data } = await supabase.auth.getSession();  const user = data.session?.user;  unauthUser = user ?? null;  return user ?? null;}export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {  const supabase = getSupabaseClient();  if (!supabase) {    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };  }  const { error } = await supabase.auth.signInWithPassword({ email, password });  if (error) {    return { error: humanizeAuthError(error.message) };  }  return { error: null };}export async function signUpNewUser(email: string, password: string): Promise<{ error: string | null }> {  const supabase = getSupabaseClient();  if (!supabase) {    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };  }  const { error } = await supabase.auth.signUp({ email, password });  if (error) {    return { error: humanizeAuthError(error.message) };  }  return { error: null };}export async function signOutSession(): Promise<void> {  const supabase = getSupabaseClient();  if (!supabase) return;  try {    await supabase.auth.signOut();  } catch {    unauthUser = null;  }  unauthUser = null;}export async function requestPasswordReset(email: string, redirectTo: string): Promise<{ error: string | null }> {  const supabase = getSupabaseClient();  if (!supabase) {    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };  }  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });  if (error) {    return { error: humanizeAuthError(error.message) };  }  return { error: null };}/** Applies the fragments from a Supabase magic-style recovery link (`#access_token=…&type=recovery`). */export async function applyRecoverySession(hash: string): Promise<{ error: string | null }> {  const supabase = getSupabaseClient();  if (!supabase) {    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };  }  const params = new URLSearchParams(hash.replace(/^#/, ""));  if (params.get("type") !== "recovery") {    return { error: "This link is not a password-recovery link." };  }  const accessToken = params.get("access_token");  const refreshToken = params.get("refresh_token");  if (!accessToken || !refreshToken) {    return { error: "This recovery link is missing tokens. Request a new one." };  }  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });  if (error) {    return { error: humanizeAuthError(error.message) };  }  unauthUser = (await supabase.auth.getSession()).data.session?.user ?? null;  return { error: null };}export async function updateUserPassword(newPassword: string): Promise<{ error: string | null }> {  const supabase = getSupabaseClient();  if (!supabase) {    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };  }  const { error } = await supabase.auth.updateUser({ password: newPassword });  if (error) {    return { error: humanizeAuthError(error.message) };  }  return { error: null };}export function cachedUnauthUser(): User | null {  return unauthUser ?? null;}function humanizeAuthError(message: string): string {  const lower = message.toLowerCase();  if (lower.includes("invalid login credentials")) {    return "Invalid email or password.";  }  if (lower.includes("email not confirmed")) {    return "Check your inbox — your email still needs to be confirmed.";  }  if (lower.includes("user already registered")) {    return "An account already exists for this email. Try signing in instead.";  }  if (lower.includes("password should be at least")) {    return "Password must be at least 6 characters.";  }  return message;}export function supabaseAuthError(): ApiError {  return new ApiError(503, "AUTH_NOT_CONFIGURED", "Supabase auth is not configured.");}

export interface AuthProviderSettings {
  email: boolean;
  phone: boolean;
  google: boolean;
  github: boolean;
  apple: boolean;
  azure: boolean;
  discord: boolean;
  figma: boolean;
  gitlab: boolean;
  linkedin: boolean;
  notion: boolean;
  slack: boolean;
  spotify: boolean;
  twitch: boolean;
  twitter: boolean;
  zoom: boolean;
}

const KNOWN_PROVIDERS = [
  "email",
  "phone",
  "google",
  "github",
  "apple",
  "azure",
  "discord",
  "figma",
  "gitlab",
  "linkedin",
  "notion",
  "slack",
  "spotify",
  "twitch",
  "twitter",
  "zoom",
] as const satisfies ReadonlyArray<keyof AuthProviderSettings>;

/**
 * Reads which social providers the Supabase project has enabled via the public
 * `GET /auth/v1/settings` endpoint. Provider availability is config-driven: what
 * the project allows, minus any `NEXT_PUBLIC_AUTH_DISABLED_PROVIDERS` overrides.
 */
export async function fetchAuthProviderSettings(): Promise<AuthProviderSettings | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const external = (await res.json())?.external as Record<string, { enabled?: boolean }> | undefined;
    const settings = {} as AuthProviderSettings;
    for (const name of KNOWN_PROVIDERS) {
      settings[name] = external?.[name]?.enabled === true;
    }
    const disabled = new Set(
      (process.env.NEXT_PUBLIC_AUTH_DISABLED_PROVIDERS ?? "").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean)
    );
    for (const name of KNOWN_PROVIDERS) {
      if (disabled.has(name)) settings[name] = false;
    }
    return settings;
  } catch {
    return null;
  }
}

/** Starts a social sign-in and returns the provider authorization URL to follow. */
export async function signInWithProvider(
  provider: "google" | "github",
  redirectTo: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { url: null, error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };
  }
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) return { url: null, error: humanizeAuthError(error.message) };
  return { url: data?.url ?? null, error: null };
}

/** Exchanges the PKCE auth code the callback received for a persisted session. */
export async function exchangeAuthCode(code: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { error: humanizeAuthError(error.message) };
  unauthUser = (await supabase.auth.getSession()).data.session?.user ?? null;
  return { error: null };
}

/** Applies a PKCE password-recovery link (`?code=…&type=recovery`). */
export async function applyRecoveryCode(code: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { error: humanizeAuthError(error.message) };
  unauthUser = (await supabase.auth.getSession()).data.session?.user ?? null;
  return { error: null };
}