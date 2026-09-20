import { DEMO_MODE } from "@/lib/demo/users";
import type { NetworkIdentity, Web3Mode } from "./types";

const MAINNET_CHAIN_IDS = new Set([1, 56, 137, 42161, 10, 8453, 43114, 81457, 59144, 534352]);

export interface Web3ConfigSnapshot {
  enabled: boolean;
  mode: Web3Mode;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string | null;
  tokenAddress: string | null;
  distributorAddress: string | null;
  stakeVaultAddress: string | null;
  registryAddress: string | null;
  network: string;
}

function sanitizeAddress(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function buildConfig(): Web3ConfigSnapshot {
  const chainIdRaw = process.env.NEXT_PUBLIC_WEB3_CHAIN_ID;
  const chainId = Number.parseInt(chainIdRaw ?? "", 10);

  if (DEMO_MODE) {
    return {
      enabled: false,
      mode: "demo",
      chainId: Number.isFinite(chainId) && chainId > 0 ? chainId : 0,
      rpcUrl: process.env.NEXT_PUBLIC_WEB3_RPC_URL ?? "",
      explorerUrl: process.env.NEXT_PUBLIC_WEB3_EXPLORER_URL || null,
      tokenAddress: sanitizeAddress(process.env.NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS),
      distributorAddress: sanitizeAddress(process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS),
      stakeVaultAddress: sanitizeAddress(process.env.NEXT_PUBLIC_STAKE_VAULT_ADDRESS),
      registryAddress: sanitizeAddress(process.env.NEXT_PUBLIC_CONTRIBUTION_REGISTRY_ADDRESS),
      network: "Demo",
    };
  }

  if (!Number.isFinite(chainId) || chainId <= 0) {
    return {
      enabled: false,
      mode: "testnet",
      chainId: 0,
      rpcUrl: "",
      explorerUrl: null,
      tokenAddress: null,
      distributorAddress: null,
      stakeVaultAddress: null,
      registryAddress: null,
      network: "Unconfigured",
    };
  }

  if (MAINNET_CHAIN_IDS.has(chainId)) {
    throw new Error(
      `Refusing to run web3 with mainnet chain id ${chainId}. Puvexa is not deployed on a production network.`,
    );
  }

  const local = process.env.NEXT_PUBLIC_WEB3_ENV === "local" || chainId === 31337;
  const enabled =
    Boolean(process.env.NEXT_PUBLIC_WEB3_RPC_URL) &&
    (sanitizeAddress(process.env.NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS) ? true : false) &&
    (sanitizeAddress(process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS) ? true : false);

  return {
    enabled,
    mode: local ? "local" : "testnet",
    chainId,
    rpcUrl: process.env.NEXT_PUBLIC_WEB3_RPC_URL ?? "",
    explorerUrl: process.env.NEXT_PUBLIC_WEB3_EXPLORER_URL || null,
    tokenAddress: sanitizeAddress(process.env.NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS),
    distributorAddress: sanitizeAddress(process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS),
    stakeVaultAddress: sanitizeAddress(process.env.NEXT_PUBLIC_STAKE_VAULT_ADDRESS),
    registryAddress: sanitizeAddress(process.env.NEXT_PUBLIC_CONTRIBUTION_REGISTRY_ADDRESS),
    network: local ? "Local Anvil" : "Testnet",
  };
}

export const web3Config: Web3ConfigSnapshot = buildConfig();

export function isDemoMode(): boolean {
  return DEMO_MODE;
}

export function networkIdentity(): NetworkIdentity {
  if (DEMO_MODE) {
    return {
      mode: "demo",
      label: "DEMO",
      tone: "demo",
      note: "Simulated environment. No blockchain is connected.",
    };
  }
  if (!web3Config.enabled) {
    return {
      mode: "testnet",
      label: "TESTNET",
      tone: "testnet",
      note: "Web3 is not configured. Set NEXT_PUBLIC_WEB3_* to enable.",
    };
  }
  if (web3Config.mode === "local") {
    return {
      mode: "local",
      label: "LOCAL",
      tone: "local",
      note: "Local Anvil network. Contracts are development fixtures.",
    };
  }
  return {
    mode: "testnet",
    label: "TESTNET",
    tone: "testnet",
    note: "Public testnet. Tokens hold no real value.",
  };
}

export function explorerTxUrl(txHash: string): string | null {
  if (!web3Config.explorerUrl) return null;
  return `${web3Config.explorerUrl}/tx/${txHash}`;
}

export function chainLabel(chainId: number): string {
  switch (chainId) {
    case 31337:
      return "Local Anvil";
    case 97:
      return "BNB Testnet";
    case 11155111:
      return "Sepolia";
    default:
      return `Chain ${chainId}`;
  }
}

export function explorerAddressUrl(address: string): string | null {
  if (!web3Config.explorerUrl) return null;
  return `${web3Config.explorerUrl}/address/${address}`;
}

export function connectorLabels(): Record<string, string> {
  return { injected: "MetaMask" };
}