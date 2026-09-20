import { apiGet, apiPost } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/supabase";
import type { WalletChallenge, Web3Status, Web3TransactionRecord, ClaimReservation } from "@/lib/web3/types";
import { mapWalletChallenge, mapWeb3Status, mapWeb3Transaction, mapClaimReservation, type PreparedClaimPayload } from "@/lib/web3/mappers";

export interface PrepareClaimParams {
  rewardId: string;
  walletAddress: string;
  chainId: number;
}

export interface VerifyWalletParams {
  address: string;
  chainId: number;
  signature: string;
  nonce: string | null;
}

export interface ConfirmClaimParams {
  claimId: string;
  txHash: string;
  chainId: number;
}

export interface ConfirmStakeParams {
  contributionId: string;
  walletAddress: string;
  txHash: string;
  chainId: number;
}

export interface ConfirmSettlementParams {
  contributionId: string;
  kind: "release" | "slash";
  txHash: string;
  chainId: number;
}

/**
 * Raw API service for the Phase 5 web3 economy endpoints. The only layer that
 * talks to the backend web3 API — React components never fetch these endpoints
 * directly. Chain operations (connecting, signing, broadcasting) live in the
 * action layer; this service only reads/writes REST state and never invents data.
 */
export class ApiWeb3Service {
  async status(): Promise<Web3Status> {
    const data = await apiGet<Record<string, unknown>>("/api/v1/web3/status");
    return mapWeb3Status(data);
  }

  async tokenConfig(): Promise<Record<string, unknown>> {
    return apiGet<Record<string, unknown>>("/api/v1/web3/token");
  }

  async requestChallenge(address: string, chainId: number): Promise<WalletChallenge> {
    const data = await apiPost<Record<string, unknown>>(
      "/api/v1/wallet/challenge",
      { address, chain_id: chainId },
      await getAccessToken(),
    );
    return mapWalletChallenge(data);
  }

  async verifyWallet(params: VerifyWalletParams): Promise<{ status: string; walletAddress: string; verifiedAt?: string }> {
    const data = await apiPost<Record<string, string>>(
      "/api/v1/wallet/verify",
      {
        address: params.address,
        chain_id: params.chainId,
        signature: params.signature,
        nonce: params.nonce,
      },
      await getAccessToken(),
    );
    return {
      status: String(data["status"]),
      walletAddress: String(data["wallet_address"] ?? params.address),
      verifiedAt: data["verified_at"] ?? undefined,
    };
  }

  async prepareClaim(params: PrepareClaimParams): Promise<PreparedClaimPayload> {
    return apiPost<PreparedClaimPayload>(
      "/api/v1/web3/claims/prepare",
      { reward_id: params.rewardId, wallet_address: params.walletAddress, chain_id: params.chainId },
      await getAccessToken(),
    );
  }

  async confirmClaim(params: ConfirmClaimParams): Promise<Record<string, unknown>> {
    return apiPost<Record<string, unknown>>(
      "/api/v1/web3/claims/confirm",
      { claim_id: params.claimId, tx_hash: params.txHash, chain_id: params.chainId },
      await getAccessToken(),
    );
  }

  async confirmStake(params: ConfirmStakeParams): Promise<Record<string, unknown>> {
    return apiPost<Record<string, unknown>>(
      "/api/v1/web3/stakes/confirm",
      {
        contribution_id: params.contributionId,
        wallet_address: params.walletAddress,
        tx_hash: params.txHash,
        chain_id: params.chainId,
      },
      await getAccessToken(),
    );
  }

  async confirmStakeSettlement(params: ConfirmSettlementParams): Promise<Record<string, unknown>> {
    const path =
      params.kind === "release"
        ? `/api/v1/web3/stakes/${params.contributionId}/release`
        : `/api/v1/web3/stakes/${params.contributionId}/slash`;
    return apiPost<Record<string, unknown>>(
      path,
      { tx_hash: params.txHash, chain_id: params.chainId },
      await getAccessToken(),
    );
  }

  async claims(): Promise<ClaimReservation[]> {
    const data = await apiGet<{ items?: Record<string, unknown>[]; total?: number; items_per_page?: number }>(
      "/api/v1/web3/claims",
      await getAccessToken(),
    );
    return (data.items ?? []).map(mapClaimReservation);
  }

  async transactions(): Promise<Web3TransactionRecord[]> {
    const data = await apiGet<{ items?: Record<string, unknown>[]; total?: number }>(
      "/api/v1/web3/transactions",
      await getAccessToken(),
    );
    return (data.items ?? []).map(mapWeb3Transaction);
  }
}

export const apiWeb3Service = new ApiWeb3Service();