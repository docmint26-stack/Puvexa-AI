import type { Address, Hash } from "viem";
import type { WalletChallenge } from "./types";
import type { PreparedClaimPayload } from "./mappers";

export type ClaimStep =
  | "idle"
  | "preparing"
  | "awaiting_wallet"
  | "submitting"
  | "waiting_chain"
  | "confirming"
  | "confirmed"
  | "expired"
  | "failed";

export interface ClaimFlowState {
  step: ClaimStep;
  claimId: string | null;
  txHash: string | null;
  amountWei: string | null;
  error: string | null;
  code: string | null;
  prepared: PreparedClaimPayload | null;
}

export const idleClaimState: ClaimFlowState = {
  step: "idle",
  claimId: null,
  txHash: null,
  amountWei: null,
  error: null,
  code: null,
  prepared: null,
};

export interface ClaimFlowDeps {
  prepareClaim(params: { rewardId: string; walletAddress: string; chainId: number }): Promise<PreparedClaimPayload>;
  submitClaim(
    claim: { claimId: Hash; recipient: Address; amount: bigint; deadline: bigint },
    signature: Hash,
    distributorAddress: Address,
  ): Promise<Hash>;
  waitForReceipt(hash: Hash): Promise<{ status: "success" | "reverted"; blockNumber: bigint | null }>;
  confirmClaim(params: { claimId: string; txHash: string; chainId: number }): Promise<unknown>;
  now?(): number;
}

export async function runClaimFlow(
  deps: ClaimFlowDeps,
  params: { rewardId: string; walletAddress: string; chainId: number },
  send: (state: ClaimFlowState) => void,
): Promise<ClaimFlowState> {
  const now = deps.now?.() ?? Date.now() / 1000;
  send({ ...idleClaimState, step: "preparing" });
  try {
    const prepared = await deps.prepareClaim(params);
    const claim: { claimId: Hash; recipient: Address; amount: bigint; deadline: bigint } = {
      claimId: prepared.claim_id as Hash,
      recipient: prepared.recipient as Address,
      amount: BigInt(prepared.amount_wei),
      deadline: BigInt(prepared.deadline),
    };
    send({ ...idleClaimState, step: "awaiting_wallet", claimId: prepared.claim_id, amountWei: prepared.amount_wei, prepared });
    if (prepared.deadline > 0 && now > prepared.deadline) {
      const expired = { ...idleClaimState, step: "expired" as const, claimId: prepared.claim_id, code: "CLAIM_DEADLINE_PASSED", error: "The claim signature expired. Request a new one." };
      send(expired);
      return expired;
    }
    const txHash = await deps.submitClaim(claim, prepared.signature as Hash, prepared.verifying_contract as Address);
    send({ ...idleClaimState, step: "submitting", claimId: prepared.claim_id, txHash, amountWei: prepared.amount_wei, prepared });
    const receipt = await deps.waitForReceipt(txHash);
    if (receipt.status !== "success") {
      const failed = { ...idleClaimState, step: "failed" as const, claimId: prepared.claim_id, txHash, code: "WEB3_TX_REVERTED", error: "The on-chain transaction reverted." };
      send(failed);
      return failed;
    }
    send({ ...idleClaimState, step: "confirming", claimId: prepared.claim_id, txHash, amountWei: prepared.amount_wei, prepared });
    await deps.confirmClaim({ claimId: prepared.claim_id, txHash, chainId: params.chainId });
    const confirmed = { ...idleClaimState, step: "confirmed" as const, claimId: prepared.claim_id, txHash, amountWei: prepared.amount_wei, prepared };
    send(confirmed);
    return confirmed;
  } catch (error) {
    const failed = {
      ...idleClaimState,
      step: "failed" as const,
      error: error instanceof Error ? error.message : "Claim failed.",
      code: (error as { code?: string })?.code ?? "CLAIM_FLOW_ERROR",
    };
    send(failed);
    return failed;
  }
}

/* ---------------- wallet verification ---------------- */

export interface VerifyFlowDeps {
  requestChallenge(address: string, chainId: number): Promise<WalletChallenge>;
  signMessage(message: string): Promise<Hash>;
  verifyOwnership(params: { address: string; chainId: number; signature: string; nonce: string | null }): Promise<{ status: string; walletAddress: string }>;
}

export type VerifyFlowResult =
  | { ok: true; walletAddress: string; verifiedAt?: string }
  | { ok: false; code: string; error: string };

export async function runWalletVerificationFlow(deps: VerifyFlowDeps, params: { address: string; chainId: number }): Promise<VerifyFlowResult> {
  try {
    const challenge = await deps.requestChallenge(params.address, params.chainId);
    const signature = await deps.signMessage(challenge.message);
    const result = await deps.verifyOwnership({
      address: params.address,
      chainId: params.chainId,
      signature,
      nonce: challenge.nonce,
    });
    return { ok: true, walletAddress: result.walletAddress };
  } catch (error) {
    return {
      ok: false,
      code: (error as { code?: string })?.code ?? "VERIFY_FLOW_ERROR",
      error: error instanceof Error ? error.message : "Verification failed.",
    };
  }
}

/* ---------------- staking ---------------- */

export type StakeStep =
  | "idle"
  | "checking"
  | "approval_required"
  | "approving"
  | "ready"
  | "staking"
  | "confirming"
  | "locked"
  | "failed";

export interface StakeFlowState {
  step: StakeStep;
  contributionId: string | null;
  amountWei: string | null;
  txHash: string | null;
  allowanceWei: string | null;
  error: string | null;
  code: string | null;
}

export const idleStakeState: StakeFlowState = {
  step: "idle",
  contributionId: null,
  amountWei: null,
  txHash: null,
  allowanceWei: null,
  error: null,
  code: null,
};

export interface StakeFlowDeps {
  readAllowance(owner: Address, spender: Address, tokenAddress: Address): Promise<bigint>;
  approve(spender: Address, amount: bigint, tokenAddress: Address): Promise<Hash>;
  waitForReceipt(hash: Hash): Promise<{ status: "success" | "reverted"; blockNumber: bigint | null }>;
  submitStake(contributionId: Hash, amount: bigint, vaultAddress: Address): Promise<Hash>;
  confirmStake(params: { contributionId: string; walletAddress: string; txHash: string; chainId: number }): Promise<unknown>;
}

export async function runStakeFlow(
  deps: StakeFlowDeps,
  params: { contributionId: string; contributionBytes32: Hash; amountWei: bigint; owner: Address; spender: Address; tokenAddress: Address; vaultAddress: Address; chainId: number; walletAddress: string },
  send: (state: StakeFlowState) => void,
): Promise<StakeFlowState> {
  send({ ...idleStakeState, step: "checking", contributionId: params.contributionId, amountWei: params.amountWei.toString() });
  try {
    const allowance = await deps.readAllowance(params.owner, params.spender, params.tokenAddress);
    send({ ...idleStakeState, step: "approval_required", contributionId: params.contributionId, amountWei: params.amountWei.toString(), allowanceWei: allowance.toString() });
    if (allowance < params.amountWei) {
      const approvalHash = await deps.approve(params.spender, params.amountWei, params.tokenAddress);
      send({ ...idleStakeState, step: "approving", contributionId: params.contributionId, amountWei: params.amountWei.toString(), txHash: approvalHash });
      const approvalReceipt = await deps.waitForReceipt(approvalHash);
      if (approvalReceipt.status !== "success") {
        const failedA = { ...idleStakeState, step: "failed" as const, contributionId: params.contributionId, amountWei: params.amountWei.toString(), code: "APPROVE_REVERTED", error: "Token approval reverted." };
        send(failedA);
        return failedA;
      }
    }
    send({ ...idleStakeState, step: "ready", contributionId: params.contributionId, amountWei: params.amountWei.toString(), allowanceWei: params.amountWei.toString() });
    const stakeHash = await deps.submitStake(params.contributionBytes32, params.amountWei, params.vaultAddress);
    send({ ...idleStakeState, step: "staking", contributionId: params.contributionId, amountWei: params.amountWei.toString(), txHash: stakeHash });
    const stakeReceipt = await deps.waitForReceipt(stakeHash);
    if (stakeReceipt.status !== "success") {
      const failedS = { ...idleStakeState, step: "failed" as const, contributionId: params.contributionId, amountWei: params.amountWei.toString(), txHash: stakeHash, code: "STAKE_REVERTED", error: "The stake transaction reverted." };
      send(failedS);
      return failedS;
    }
    send({ ...idleStakeState, step: "confirming", contributionId: params.contributionId, amountWei: params.amountWei.toString(), txHash: stakeHash });
    await deps.confirmStake({ contributionId: params.contributionId, walletAddress: params.walletAddress, txHash: stakeHash, chainId: params.chainId });
    const locked = { ...idleStakeState, step: "locked" as const, contributionId: params.contributionId, amountWei: params.amountWei.toString(), txHash: stakeHash };
    send(locked);
    return locked;
  } catch (error) {
    const failed = {
      ...idleStakeState,
      step: "failed" as const,
      contributionId: params.contributionId,
      amountWei: params.amountWei.toString(),
      error: error instanceof Error ? error.message : "Staking failed.",
      code: (error as { code?: string })?.code ?? "STAKE_FLOW_ERROR",
    };
    send(failed);
    return failed;
  }
}