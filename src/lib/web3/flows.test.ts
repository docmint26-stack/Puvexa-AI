import { describe, expect, it, vi } from "vitest";
import type { Address, Hash } from "viem";

import {
  runClaimFlow,
  runStakeFlow,
  runWalletVerificationFlow,
  type ClaimFlowDeps,
  type ClaimFlowState,
  type StakeFlowDeps,
  type StakeFlowState,
  type VerifyFlowDeps,
} from "./flows";
import type { PreparedClaimPayload } from "./mappers";
import type { WalletChallenge } from "./types";

const WALLET = "0x8ba1f109551bD432803012645Ac136ddd64DBA72" as Address;
const CONTRACT = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const VAULT = "0x3333333333333333333333333333333333333333" as Address;

const TWENTY_FIX = "20000000000000000000";

function prepared(): PreparedClaimPayload {
  return {
    claim_id: "claim-1",
    reward_id: "reward-7",
    recipient: WALLET,
    token_address: TOKEN,
    verifying_contract: CONTRACT,
    chain_id: 31337,
    amount_fixai: "20",
    amount_wei: TWENTY_FIX,
    deadline: 2_000_000_000,
    eip712: {},
    signature: "0x1111",
    digest: "0x0000",
  };
}

describe("runClaimFlow", () => {
  it("walks the happy path to confirmed", async () => {
    const steps: string[] = [];
    const deps: ClaimFlowDeps = {
      prepareClaim: vi.fn().mockResolvedValue(prepared()),
      submitClaim: vi.fn().mockResolvedValue("0xabc" as Hash),
      waitForReceipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: BigInt(10) }),
      confirmClaim: vi.fn().mockResolvedValue({}),
    };
    const send = (s: ClaimFlowState) => steps.push(s.step);

    const final = await runClaimFlow(deps, { rewardId: "reward-7", walletAddress: WALLET, chainId: 31337 }, send);

    expect(final.step).toBe("confirmed");
    expect(final.claimId).toBe("claim-1");
    expect(final.txHash).toBe("0xabc");
    expect(final.amountWei).toBe(TWENTY_FIX);
    expect(steps).toEqual(["preparing", "awaiting_wallet", "submitting", "confirming", "confirmed"]);
    expect(deps.submitClaim).toHaveBeenCalledWith(
      { claimId: "claim-1", recipient: WALLET, amount: BigInt(TWENTY_FIX), deadline: BigInt(2_000_000_000) },
      "0x1111",
      CONTRACT,
    );
  });

  it("expires before broadcasting when the deadline passed", async () => {
    const deps: ClaimFlowDeps = {
      prepareClaim: vi.fn().mockResolvedValue(prepared()),
      submitClaim: vi.fn(),
      waitForReceipt: vi.fn(),
      confirmClaim: vi.fn(),
      now: () => 3_000_000_000,
    };
    const steps: string[] = [];
    const final = await runClaimFlow(deps, { rewardId: "reward-7", walletAddress: WALLET, chainId: 31337 }, (s) => steps.push(s.step));

    expect(final.step).toBe("expired");
    expect(final.code).toBe("CLAIM_DEADLINE_PASSED");
    expect(deps.submitClaim).not.toHaveBeenCalled();
    expect(steps).toEqual(["preparing", "awaiting_wallet", "expired"]);
  });

  it("fails when the on-chain transaction reverts", async () => {
    const deps: ClaimFlowDeps = {
      prepareClaim: vi.fn().mockResolvedValue(prepared()),
      submitClaim: vi.fn().mockResolvedValue("0xabc" as Hash),
      waitForReceipt: vi.fn().mockResolvedValue({ status: "reverted", blockNumber: null }),
      confirmClaim: vi.fn(),
    };
    const final = await runClaimFlow(deps, { rewardId: "reward-7", walletAddress: WALLET, chainId: 31337 }, () => {});

    expect(final.step).toBe("failed");
    expect(final.code).toBe("WEB3_TX_REVERTED");
  });

  it("surfaces unexpected errors with their code", async () => {
    const deps: ClaimFlowDeps = {
      prepareClaim: vi.fn().mockRejectedValue(Object.assign(new Error("Not configured."), { code: "WEB3_UNCONFIGURED" })),
      submitClaim: vi.fn(),
      waitForReceipt: vi.fn(),
      confirmClaim: vi.fn(),
    };
    const final = await runClaimFlow(deps, { rewardId: "reward-7", walletAddress: WALLET, chainId: 31337 }, () => {});

    expect(final.step).toBe("failed");
    expect(final.code).toBe("WEB3_UNCONFIGURED");
    expect(final.error).toContain("Not configured.");
  });
});

describe("runWalletVerificationFlow", () => {
  const challenge: WalletChallenge = {
    nonce: "nonce-1",
    message: "Puvexa wallet verification",
    expiresAt: "2026-09-01T10:00:00Z",
    ttlMinutes: 15,
  };

  it("verifies ownership on a signed challenge", async () => {
    const deps: VerifyFlowDeps = {
      requestChallenge: vi.fn().mockResolvedValue(challenge),
      signMessage: vi.fn().mockResolvedValue("0x2222" as Hash),
      verifyOwnership: vi.fn().mockResolvedValue({ status: "verified", walletAddress: WALLET }),
    };
    const result = await runWalletVerificationFlow(deps, { address: WALLET, chainId: 31337 });

    expect(result).toMatchObject({ ok: true, walletAddress: WALLET });
    expect(deps.signMessage).toHaveBeenCalledWith(challenge.message);
    expect(deps.verifyOwnership).toHaveBeenCalledWith({
      address: WALLET,
      chainId: 31337,
      signature: "0x2222",
      nonce: "nonce-1",
    });
  });

  it("reports a verification failure without throwing", async () => {
    const deps: VerifyFlowDeps = {
      requestChallenge: vi.fn().mockResolvedValue(challenge),
      signMessage: vi.fn().mockResolvedValue("0x2222" as Hash),
      verifyOwnership: vi.fn().mockRejectedValue(new Error("Signature did not match the wallet.")),
    };
    const result = await runWalletVerificationFlow(deps, { address: WALLET, chainId: 31337 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Signature did not match");
    }
  });
});

describe("runStakeFlow", () => {
  const params = {
    contributionId: "contribution-1",
    contributionBytes32: "0xabcd" as Hash,
    amountWei: BigInt(TWENTY_FIX),
    owner: WALLET,
    spender: VAULT,
    tokenAddress: TOKEN,
    vaultAddress: VAULT,
    chainId: 31337,
    walletAddress: WALLET,
  };

  it("locks a stake directly when allowance is sufficient", async () => {
    const steps: string[] = [];
    const deps: StakeFlowDeps = {
      readAllowance: vi.fn().mockResolvedValue(BigInt(TWENTY_FIX)),
      approve: vi.fn(),
      waitForReceipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: BigInt(10) }),
      submitStake: vi.fn().mockResolvedValue("0xabc" as Hash),
      confirmStake: vi.fn().mockResolvedValue({}),
    };

    const final = await runStakeFlow(
      deps,
      params,
      (s: StakeFlowState) => steps.push(s.step),
    );

    expect(final.step).toBe("locked");
    expect(final.txHash).toBe("0xabc");
    expect(deps.approve).not.toHaveBeenCalled();
    expect(steps).toEqual(["checking", "approval_required", "ready", "staking", "confirming", "locked"]);
  });

  it("requests approval first when allowance is insufficient", async () => {
    const deps: StakeFlowDeps = {
      readAllowance: vi.fn().mockResolvedValue(BigInt(0)),
      approve: vi.fn().mockResolvedValue("0xappr" as Hash),
      waitForReceipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: BigInt(5) }),
      submitStake: vi.fn().mockResolvedValue("0xabc" as Hash),
      confirmStake: vi.fn().mockResolvedValue({}),
    };
    const steps: string[] = [];

    const final = await runStakeFlow(deps, params, (s: StakeFlowState) => steps.push(s.step));

    expect(final.step).toBe("locked");
    expect(deps.approve).toHaveBeenCalledWith(VAULT, BigInt(TWENTY_FIX), TOKEN);
    expect(steps).toEqual(["checking", "approval_required", "approving", "ready", "staking", "confirming", "locked"]);
  });

  it("fails if the token approval reverts", async () => {
    const deps: StakeFlowDeps = {
      readAllowance: vi.fn().mockResolvedValue(BigInt(0)),
      approve: vi.fn().mockResolvedValue("0xappr" as Hash),
      waitForReceipt: vi.fn().mockResolvedValue({ status: "reverted", blockNumber: null }),
      submitStake: vi.fn(),
      confirmStake: vi.fn(),
    };
    const final = await runStakeFlow(deps, params, () => {});
    expect(final.step).toBe("failed");
    expect(final.code).toBe("APPROVE_REVERTED");
  });

  it("fails if the stake transaction reverts", async () => {
    const deps: StakeFlowDeps = {
      readAllowance: vi.fn().mockResolvedValue(BigInt(TWENTY_FIX)),
      approve: vi.fn(),
      waitForReceipt: vi.fn().mockResolvedValue({ status: "reverted", blockNumber: null }),
      submitStake: vi.fn().mockResolvedValue("0xabc" as Hash),
      confirmStake: vi.fn(),
    };
    const final = await runStakeFlow(deps, params, () => {});
    expect(final.step).toBe("failed");
    expect(final.code).toBe("STAKE_REVERTED");
  });

  it("captures unexpected errors when reserving a stake fails", async () => {
    const deps: StakeFlowDeps = {
      readAllowance: vi.fn().mockRejectedValue(new Error("RPC unreachable.")),
      approve: vi.fn(),
      waitForReceipt: vi.fn(),
      submitStake: vi.fn(),
      confirmStake: vi.fn(),
    };
    const final = await runStakeFlow(deps, params, () => {});
    expect(final.step).toBe("failed");
    expect(final.error).toContain("RPC unreachable.");
  });
});