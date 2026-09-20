export type Web3Mode = "demo" | "local" | "testnet";

export interface NetworkIdentity {
  mode: Web3Mode;
  label: string;
  tone: "local" | "testnet" | "demo";
  note: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface WalletChallenge {
  nonce: string;
  message: string;
  expiresAt: string;
  ttlMinutes: number;
}

export type ClaimReservationStatus = "reserved" | "confirmed" | "released" | "expired" | "failed";

export interface ClaimReservation {
  claimId: string;
  rewardId: string;
  recipient: string;
  tokenAddress: string;
  verifyingContract: string;
  chainId: number;
  amountWei: string;
  amountDecimal: number;
  deadline: number;
  state: ClaimReservationStatus;
  reservedAt: string;
  confirmedAt?: string | null;
  txHash?: string | null;
  signature?: string;
  eip712?: Record<string, unknown>;
}

export type Web3TransactionType =
  | "claim"
  | "stake"
  | "stake_release"
  | "stake_slash"
  | "reward"
  | "royalty"
  | "other";

export type Web3TransactionStatus = "submitted" | "confirmed" | "failed";

export interface Web3TransactionRecord {
  id: string;
  type: Web3TransactionType;
  status: Web3TransactionStatus;
  chainId: number;
  txHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: number | null;
  createdAt: string;
  confirmedAt?: string | null;
  claimId?: string | null;
}

export type StakeStatus = "staked" | "released" | "slashed";

export interface StakeRecord {
  contributionId: string;
  contributor: string;
  amountWei: string;
  amountDecimal: number;
  token: string;
  chainId: number;
  status: StakeStatus;
  stakedHash?: string | null;
  settledHash?: string | null;
}

export interface RoyaltyRecord {
  id: string;
  planId: string;
  planName: string;
  contributorId: string;
  contributorName: string;
  amountWei: string;
  amountDecimal: number;
  shareBps: number;
  window: string;
  status: "accrued" | "distributed";
  distributedAt?: string | null;
}

export interface Web3Status {
  enabled: boolean;
  chainId: number;
  network: string;
  tokenAddress: string | null;
  distributorAddress: string | null;
  stakeVaultAddress: string | null;
  registryAddress: string | null;
  rpcConfigured: boolean;
  claimEnabled: boolean;
  connected: boolean;
  signerAddress?: string;
}

export type WalletViewStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong_network"
  | "verifying"
  | "verified"
  | "error";