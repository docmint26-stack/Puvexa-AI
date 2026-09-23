import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const auth = {
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    getSession: vi.fn(),
  };
  return { auth, createClient: vi.fn(() => ({ auth })) };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const URL = "https://kydlrlbpvhrhzyhufwna.supabase.co";
const KEY = "sb_publishable_test";
const ANON = "sb_anon_test";

async function freshModule() {
  vi.resetModules();
  return await import("./supabase");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("client env configuration", () => {
  it("is not configured when env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const mod = await freshModule();
    expect(mod.isSupabaseConfigured()).toBe(false);
    expect(mod.getSupabaseClient()).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("builds a client from NEXT_PUBLIC_SUPABASE_URL + publishable key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const mod = await freshModule();
    expect(mod.isSupabaseConfigured()).toBe(true);
    expect(mod.getSupabaseClient()).not.toBeNull();
    expect(mocks.createClient).toHaveBeenCalledWith(
      URL,
      KEY,
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true }) })
    );
  });

  it("prefers the publishable key over the legacy anon key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON);
    const mod = await freshModule();
    mod.getSupabaseClient();
    expect(mocks.createClient).toHaveBeenCalledWith(URL, KEY, expect.any(Object));
  });
});

describe("signInWithProvider", () => {
  it("returns the authorization URL and forwards redirectTo", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const mod = await freshModule();
    mocks.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://github.com/login/oauth/authorize?foo=bar" },
      error: null,
    });
    const result = await mod.signInWithProvider("github", "https://app.example.com/auth/callback");
    expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "https://app.example.com/auth/callback" },
    });
    expect(result).toEqual({ url: "https://github.com/login/oauth/authorize?foo=bar", error: null });
  });

  it("humanizes provider errors and returns no URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const mod = await freshModule();
    mocks.auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "OAuth error: Provider is not enabled" },
    });
    const result = await mod.signInWithProvider("google", "https://app.example.com/auth/callback");
    expect(result.url).toBeNull();
    expect(result.error).toContain("Provider is not enabled");
  });

  it("blocks unconfigured environments without calling OAuth", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const mod = await freshModule();
    const result = await mod.signInWithProvider("github", "https://app.example.com/auth/callback");
    expect(result.error).toContain("not configured");
    expect(mocks.auth.signInWithOAuth).not.toHaveBeenCalled();
  });
});

describe("exchangeAuthCode", () => {
  it("exchanges the PKCE code and caches the session user", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const mod = await freshModule();
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    const result = await mod.exchangeAuthCode("code-123");
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith("code-123");
    expect(result).toEqual({ error: null });
    expect(mod.cachedUnauthUser()?.id).toBe("user-1");
  });

  it("surfaces exchange errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const mod = await freshModule();
    mocks.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: "PKCE verification failed" },
    });
    const result = await mod.exchangeAuthCode("stale-code");
    expect(result.error).toContain("PKCE");
  });
});

describe("fetchAuthProviderSettings", () => {
  it("maps the project's external provider flags", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          external: { email: { enabled: true }, github: { enabled: true }, google: { enabled: false } },
        }),
      })
    );
    const mod = await freshModule();
    const settings = await mod.fetchAuthProviderSettings();
    expect(settings?.email).toBe(true);
    expect(settings?.github).toBe(true);
    expect(settings?.google).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      `${URL}/auth/v1/settings`,
      expect.objectContaining({ headers: expect.objectContaining({ apikey: KEY }) })
    );
  });

  it("honors NEXT_PUBLIC_AUTH_DISABLED_PROVIDERS overrides", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLED_PROVIDERS", "github,google");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ external: { email: { enabled: true }, github: { enabled: true }, google: { enabled: true } } }),
      })
    );
    const mod = await freshModule();
    const settings = await mod.fetchAuthProviderSettings();
    expect(settings?.github).toBe(false);
    expect(settings?.google).toBe(false);
    expect(settings?.email).toBe(true);
  });

  it("returns null when settings are unreachable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const mod = await freshModule();
    expect(await mod.fetchAuthProviderSettings()).toBeNull();
  });
});

describe("applyRecoveryCode", () => {
  it("exchanges a PKCE password-recovery code", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const mod = await freshModule();
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const result = await mod.applyRecoveryCode("recovery-code");
    expect(result).toEqual({ error: null });
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
  });
});