import { afterEach, describe, expect, it, vi } from "vitest";

import type { Web3ConfigSnapshot } from "./config";

const RPC = "http://127.0.0.1:8545";
const TOKEN = "0x0000000000000000000000000000000000000001";
const DISTRIBUTOR = "0x0000000000000000000000000000000000000002";
const VAULT = "0x0000000000000000000000000000000000000003";

async function loadConfig(): Promise<Web3ConfigSnapshot> {
  vi.resetModules();
  const mod = await import("./config");
  return mod.web3Config;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("web3 config modes", () => {
  it("disables web3 in demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "31337");
    const cfg = await loadConfig();
    expect(cfg.mode).toBe("demo");
    expect(cfg.enabled).toBe(false);
    expect(cfg.network).toBe("Demo");
    expect(cfg.chainId).toBe(31337);
  });

  it("stays unconfigured when only a chain id is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "");
    const cfg = await loadConfig();
    expect(cfg.mode).toBe("testnet");
    expect(cfg.enabled).toBe(false);
    expect(cfg.network).toBe("Unconfigured");
  });

  it("enables local Anvil mode when WEB3_ENV=local and contracts are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "31337");
    vi.stubEnv("NEXT_PUBLIC_WEB3_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_WEB3_RPC_URL", RPC);
    vi.stubEnv("NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS", TOKEN);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", DISTRIBUTOR);
    vi.stubEnv("NEXT_PUBLIC_STAKE_VAULT_ADDRESS", VAULT);
    const cfg = await loadConfig();
    expect(cfg.mode).toBe("local");
    expect(cfg.enabled).toBe(true);
    expect(cfg.network).toBe("Local Anvil");
    expect(cfg.chainId).toBe(31337);
    expect(cfg.rpcUrl).toBe(RPC);
    expect(cfg.stakeVaultAddress).toBe(VAULT);
  });

  it("recognizes chain id 31337 as local even without WEB3_ENV", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "31337");
    vi.stubEnv("NEXT_PUBLIC_WEB3_RPC_URL", RPC);
    vi.stubEnv("NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS", TOKEN);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", DISTRIBUTOR);
    const cfg = await loadConfig();
    expect(cfg.mode).toBe("local");
  });

  it("marks a public testnet chain as testnet mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "11155111");
    vi.stubEnv("NEXT_PUBLIC_WEB3_RPC_URL", RPC);
    vi.stubEnv("NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS", TOKEN);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", DISTRIBUTOR);
    const cfg = await loadConfig();
    expect(cfg.mode).toBe("testnet");
    expect(cfg.enabled).toBe(true);
    expect(cfg.network).toBe("Testnet");
  });

  it("never enables without a token or distributor contract", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "31337");
    vi.stubEnv("NEXT_PUBLIC_WEB3_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_WEB3_RPC_URL", RPC);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", DISTRIBUTOR);
    const cfg = await loadConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.tokenAddress).toBeNull();
  });

  it("sanitizes malformed addresses to null", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "31337");
    vi.stubEnv("NEXT_PUBLIC_WEB3_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_WEB3_RPC_URL", RPC);
    vi.stubEnv("NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS", "0xzzz");
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", DISTRIBUTOR);
    const cfg = await loadConfig();
    expect(cfg.tokenAddress).toBeNull();
    expect(cfg.distributorAddress).toBe(DISTRIBUTOR);
  });

  it("refuses to run on a mainnet chain id", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_WEB3_CHAIN_ID", "1");
    vi.stubEnv("NEXT_PUBLIC_WEB3_RPC_URL", RPC);
    vi.stubEnv("NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS", TOKEN);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", DISTRIBUTOR);
    await expect(loadConfig()).rejects.toThrow(/mainnet/i);
  });
});

describe("web3 network identity", () => {
  it("labels the testnet when web3 is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.resetModules();
    const mod = await import("./config");
    expect(mod.networkIdentity().mode).toBe("testnet");
    expect(mod.networkIdentity().label).toBe("TESTNET");
  });

  it("labels demo mode as DEMO", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.resetModules();
    const mod = await import("./config");
    expect(mod.networkIdentity().label).toBe("DEMO");
    expect(mod.isDemoMode()).toBe(true);
  });
});