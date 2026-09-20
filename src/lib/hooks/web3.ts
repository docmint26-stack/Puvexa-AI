import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address, Hash } from "viem";
import { apiWeb3Service } from "@/lib/api/web3";
import { connectWallet, disconnectWallet, signMessageText, readTokenBalance, readTokenAllowance, approveTokens, submitClaim, submitStake, waitForReceipt, getConnectedAccount, switchToChain, describeWeb3Error } from "@/lib/web3/actions";
import { web3Config, networkIdentity, isDemoMode } from "@/lib/web3/config";
import { contributionIdBytes32, weiToDecimal } from "@/lib/web3/mappers";
import { useWalletStore } from "@/lib/state/wallet";
import { runClaimFlow, runStakeFlow, runWalletVerificationFlow, type ClaimFlowState, type StakeFlowState } from "@/lib/web3/flows";
import type { ClaimReservation, Web3Status, Web3TransactionRecord } from "@/lib/web3/types";
import { useWallet } from "./index";

export function useWeb3Identity() {
  const config = useMemo(() => web3Config, []);
  const identity = useMemo(() => networkIdentity(), []);
  const demo = isDemoMode();
  return { config, identity, demo };
}

export function useWeb3Status() {
  const [status, setStatus] = useState<Web3Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { config } = { config: web3Config };
    if (!config.enabled) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await apiWeb3Service.status());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load web3 status.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { status, error, reload };
}

export function useWalletBalance(owner: Address | null, tokenAddress: Address | null, decimals = 18) {
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!owner || !tokenAddress) {
      setBalanceWei(null);
      return;
    }
    try {
      const value = await readTokenBalance(owner, tokenAddress);
      setBalanceWei(value);
      setError(null);
    } catch (err) {
      setBalanceWei(null);
      setError(err instanceof Error ? err.message : "Could not read token balance.");
    }
  }, [owner, tokenAddress]);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), 15_000);
    const initial = setTimeout(() => void refresh(), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [refresh]);

  const balanceDecimal = balanceWei === null ? null : weiToDecimal(balanceWei, decimals);
  return { balanceWei, balanceDecimal, error, refresh };
}

export function useWalletAllowance(owner: Address | null, spender: Address | null, tokenAddress: Address | null) {
  const [allowanceWei, setAllowanceWei] = useState<bigint | null>(null);

  const refresh = useCallback(async () => {
    if (!owner || !spender || !tokenAddress) {
      setAllowanceWei(null);
      return;
    }
    try {
      setAllowanceWei(await readTokenAllowance(owner, spender, tokenAddress));
    } catch {
      setAllowanceWei(null);
    }
  }, [owner, spender, tokenAddress]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return { allowanceWei, refresh };
}

export function useWeb3History() {
  const [claims, setClaims] = useState<ClaimReservation[]>([]);
  const [transactions, setTransactions] = useState<Web3TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!web3Config.enabled) return;
    setLoading(true);
    try {
      const [c, t] = await Promise.all([apiWeb3Service.claims(), apiWeb3Service.transactions()]);
      setClaims(c);
      setTransactions(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { claims, transactions, loading, reload };
}

export function useWalletVerification() {
  const wallet = useWallet();

  const verify = useCallback(
    async (address: string, chainId: number) => {
      if (wallet.requestChallenge && wallet.verifyOwnership) {
        return runWalletVerificationFlow(
          {
            requestChallenge: wallet.requestChallenge,
            signMessage: signMessageText,
            verifyOwnership: wallet.verifyOwnership,
          },
          { address, chainId },
        );
      }
      return { ok: false as const, code: "WALLET_VERIFY_UNAVAILABLE", error: "Wallet verification is not available in this mode." };
    },
    [wallet],
  );

  const connectAndVerify = useCallback(async () => {
    try {
      const identity = await connectWallet();
      const chainOk = !web3Config.chainId || identity.chainId === web3Config.chainId;
      if (!chainOk) {
        useWalletStore.getState().setWrongNetwork(web3Config.chainId, identity.chainId);
        return { ok: false as const, code: "WRONG_NETWORK", error: "Switch to the Puvexa network and try again.", chainId: identity.chainId };
      }
      useWalletStore.getState().setConnected(identity.address, identity.chainId, web3Config.network);
      const result = await verify(identity.address, identity.chainId);
      return { ...result, chainId: identity.chainId };
    } catch (error) {
      const mapped = describeWeb3Error(error);
      useWalletStore.getState().fail(mapped.message);
      return { ok: false as const, code: mapped.code, error: mapped.message };
    }
  }, [verify]);

  const switchToAppChain = useCallback(async () => {
    try {
      await switchToChain(web3Config.chainId);
      const account = await getConnectedAccount();
      if (account && account.chainId === web3Config.chainId) {
        useWalletStore.getState().setConnected(account.address, account.chainId, web3Config.network);
      }
      return { ok: true as const };
    } catch (error) {
      const mapped = describeWeb3Error(error);
      return { ok: false as const, code: mapped.code, error: mapped.message };
    }
  }, []);

  return { verify, connectAndVerify, switchToAppChain, disconnect: disconnectWallet };
}

export function useClaimFlow() {
  const [state, setState] = useState<ClaimFlowState>({ step: "idle", claimId: null, txHash: null, amountWei: null, error: null, code: null, prepared: null });

  const start = useCallback(async (rewardId: string, walletAddress: string, chainId: number) => {
    if (!web3Config.distributorAddress) {
      setState({ step: "failed", claimId: null, txHash: null, amountWei: null, error: "The reward distributor is not configured.", code: "WEB3_UNCONFIGURED", prepared: null });
      return;
    }
    await runClaimFlow(
      {
        prepareClaim: (p) => apiWeb3Service.prepareClaim(p),
        submitClaim: (claim, signature, distributorAddress) => submitClaim(claim, signature, distributorAddress),
        waitForReceipt: (hash: Hash) => waitForReceipt(hash as Hash),
        confirmClaim: (p) => apiWeb3Service.confirmClaim(p),
      },
      { rewardId, walletAddress, chainId },
      setState,
    );
  }, []);

  const reset = useCallback(() => setState({ step: "idle", claimId: null, txHash: null, amountWei: null, error: null, code: null, prepared: null }), []);

  return { state, start, reset };
}

export function useStakeFlow() {
  const [state, setState] = useState<StakeFlowState>({ step: "idle", contributionId: null, amountWei: null, txHash: null, allowanceWei: null, error: null, code: null });

  const start = useCallback(
    async (params: {
      contributionId: string;
      amountWei: bigint;
      owner: Address;
      tokenAddress: Address;
      vaultAddress: Address;
      chainId: number;
    }) => {
      if (!web3Config.stakeVaultAddress || !web3Config.tokenAddress) {
        setState({ step: "failed", contributionId: params.contributionId, amountWei: params.amountWei.toString(), txHash: null, allowanceWei: null, error: "Staking contracts are not configured.", code: "WEB3_UNCONFIGURED" });
        return;
      }
      const tokenAddress = params.tokenAddress;
      await runStakeFlow(
        {
          readAllowance: (owner, spender, token) => readTokenAllowance(owner, spender, token),
          approve: (spender, amount, token) => approveTokens(spender, amount, token),
          waitForReceipt: (hash) => waitForReceipt(hash),
          submitStake: (contributionBytes32, amount, vault) => submitStake(contributionBytes32, amount, vault),
          confirmStake: (p) => apiWeb3Service.confirmStake(p),
        },
        {
          contributionId: params.contributionId,
          contributionBytes32: contributionIdBytes32(params.contributionId),
          amountWei: params.amountWei,
          owner: params.owner,
          spender: params.vaultAddress,
          tokenAddress,
          vaultAddress: params.vaultAddress,
          chainId: params.chainId,
          walletAddress: params.owner,
        },
        setState,
      );
    },
    [],
  );

  const reset = useCallback(() => setState({ step: "idle", contributionId: null, amountWei: null, txHash: null, allowanceWei: null, error: null, code: null }), []);

  return { state, start, reset };
}

export function useIsWalletVerified(): boolean {
  const status = useWalletStore((s) => s.status);
  return status === "verified";
}