import { formatUnits, keccak256, stringToHex } from "viem";
import type {
  ClaimReservation,
  ClaimReservationStatus,
  Web3TransactionRecord,
  Web3TransactionStatus,
  Web3TransactionType,
  Web3Status,
  WalletChallenge,
} from "./types";

export function weiToDecimal(wei: string | bigint | number, decimals = 18): number {
  const raw = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  return Number(formatUnits(raw, decimals));
}

export function weiToFixed(wei: string | bigint | number, decimals = 18, fractionDigits = 4): string {
  const value = weiToDecimal(wei, decimals);
  return value.toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}

export function amountToWeiString(amount: number, decimals = 18): string {
  const raw = BigInt(Math.round(amount * 10 ** decimals));
  return raw.toString();
}

export function contributionIdBytes32(contributionId: string): `0x${string}` {
  return keccak256(stringToHex(contributionId));
}

export function normalizeRawAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const cleaned = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(cleaned)) return null;
  return cleaned.toLowerCase();
}

export function mapClaimReservation(raw: Record<string, unknown>): ClaimReservation {
  const state = String(raw["state"] ?? "reserved") as ClaimReservationStatus;
  return {
    claimId: String(raw["claim_id"] ?? ""),
    rewardId: String(raw["reward_id"] ?? ""),
    recipient: String(raw["wallet_address"] ?? ""),
    tokenAddress: String(raw["token_address"] ?? ""),
    verifyingContract: String(raw["contract_address"] ?? raw["verifying_contract"] ?? ""),
    chainId: Number(raw["chain_id"] ?? 0),
    amountWei: String(raw["amount_wei"] ?? "0"),
    amountDecimal: weiToDecimal(String(raw["amount_wei"] ?? "0")),
    deadline: Number(raw["deadline"] ?? 0),
    state,
    reservedAt: String(raw["reserved_at"] ?? ""),
    confirmedAt: raw["confirmed_at"] ? String(raw["confirmed_at"]) : null,
    txHash: raw["tx_hash"] ? String(raw["tx_hash"]) : null,
  };
}

export function mapWeb3Status(raw: Record<string, unknown>): Web3Status {
  return {
    enabled: Boolean(raw["claim_enabled"]),
    chainId: Number(raw["chain_id"] ?? 0),
    network: String(raw["network"] ?? ""),
    tokenAddress: normalizeRawAddress(String(raw["token_address"] ?? "")),
    distributorAddress: normalizeRawAddress(String(raw["distributor_address"] ?? "")),
    stakeVaultAddress: normalizeRawAddress(String(raw["stake_vault_address"] ?? "")),
    registryAddress: normalizeRawAddress(String(raw["registry_address"] ?? "")),
    rpcConfigured: Boolean(raw["rpc_configured"]),
    claimEnabled: Boolean(raw["claim_enabled"]),
    connected: Boolean(raw["connected"]),
    signerAddress: raw["signer_address"] ? String(raw["signer_address"]) : undefined,
  };
}

export function mapWalletChallenge(raw: Record<string, unknown>): WalletChallenge {
  return {
    nonce: String(raw["nonce"] ?? ""),
    message: String(raw["message"] ?? ""),
    expiresAt: String(raw["expires_at"] ?? ""),
    ttlMinutes: Number(raw["ttl_minutes"] ?? 15),
  };
}

export function mapWeb3Transaction(raw: Record<string, unknown>): Web3TransactionRecord {
  const type = String(raw["tx_type"] ?? "other") as Web3TransactionType;
  const status = String(raw["status"] ?? "submitted") as Web3TransactionStatus;
  return {
    id: String(raw["id"] ?? ""),
    type,
    status,
    chainId: Number(raw["chain_id"] ?? 0),
    txHash: raw["tx_hash"] ? String(raw["tx_hash"]) : null,
    fromAddress: normalizeRawAddress(String(raw["from_address"] ?? "")) ?? null,
    toAddress: normalizeRawAddress(String(raw["to_address"] ?? "")) ?? null,
    blockNumber: raw["block_number"] != null ? Number(raw["block_number"]) : null,
    createdAt: String(raw["created_at"] ? raw["created_at"] : raw["confirmed_at"] ?? ""),
    confirmedAt: raw["confirmed_at"] ? String(raw["confirmed_at"]) : null,
    claimId: raw["claim_id"] ? String(raw["claim_id"]) : null,
  };
}

export const TRANSACTION_TYPE_LABELS: Record<Web3TransactionType, string> = {
  claim: "Reward claim",
  stake: "Security stake",
  stake_release: "Stake released",
  stake_slash: "Stake slashed",
  reward: "Reward",
  royalty: "Royalty",
  other: "Transaction",
};

export const STAKES: Record<Web3TransactionStatus, string> = {
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
};

export function shortHash(hash: string | null): string {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export type PreparedClaimPayload = {
  claim_id: string;
  reward_id: string;
  recipient: string;
  token_address: string;
  verifying_contract: string;
  chain_id: number;
  amount_fixai: string;
  amount_wei: string;
  deadline: number;
  eip712: Record<string, unknown>;
  signature: string;
  digest: string;
};