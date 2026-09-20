import { connect, disconnect, getAccount, getChainId, readContract, reconnect, signMessage, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import type { Address, Hash } from "viem";
import { wagmiConfig } from "./client";
import { PuvexaFIXAIAbi, RewardDistributorAbi, ContributionStakeVaultAbi } from "./contracts";

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

export interface ConnectedIdentity {
  address: Address;
  chainId: number;
}

export class Web3ActionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "Web3ActionError";
    this.code = code;
  }
}

function isLike(message: string, error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes(message.toLowerCase());
}

export function describeWeb3Error(error: unknown): Web3ActionError {
  if (error instanceof Web3ActionError) return error;
  if (isLike("user rejected", error)) {
    return new Web3ActionError("USER_REJECTED", "The transaction was rejected in your wallet.");
  }
  if (isLike("user denied", error)) {
    return new Web3ActionError("USER_REJECTED", "The signature request was denied in your wallet.");
  }
  if (isLike("MetaMask - RPC", error)) {
    return new Web3ActionError("WALLET_NOT_FOUND", "No wallet provider found. Install MetaMask or a compatible wallet.");
  }
  return new Web3ActionError("WEB3_ERROR", error instanceof Error ? error.message : "Web3 operation failed.");
}

export async function getConnectedAccount(): Promise<ConnectedIdentity | null> {
  if (typeof window === "undefined") return null;
  const account = getAccount(wagmiConfig);
  if (!account.address) return null;
  return { address: account.address, chainId: getChainId(wagmiConfig) };
}

export async function connectWallet(): Promise<ConnectedIdentity> {
  if (typeof window === "undefined") throw new Web3ActionError("SSR_ONLY", "Cannot connect on the server.");
  const connector = wagmiConfig.connectors[0];
  let result;
  try {
    result = await connect(wagmiConfig, { connector });
  } catch (error) {
    throw describeWeb3Error(error);
  }
  return { address: result.accounts[0], chainId: result.chainId };
}

export async function disconnectWallet(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await disconnect(wagmiConfig);
  } catch {
    // The provider may already be gone; treat as disconnected.
  }
}

export async function reconnectWallets(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await reconnect(wagmiConfig);
  } catch {
    // No previously connected wallet is available — nothing to restore.
  }
}

export async function signMessageText(message: string): Promise<Hash> {
  if (typeof window === "undefined") throw new Web3ActionError("SSR_ONLY", "Cannot sign on the server.");
  try {
    return await signMessage(wagmiConfig, { message });
  } catch (error) {
    throw describeWeb3Error(error);
  }
}

export async function switchToChain(chainId: number): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await switchChain(wagmiConfig, { chainId });
  } catch (error) {
    throw describeWeb3Error(error);
  }
}

export async function readTokenDecimals(tokenAddress: Address): Promise<number> {
  const value = await readContract(wagmiConfig, {
    address: tokenAddress,
    abi: PuvexaFIXAIAbi,
    functionName: "decimals",
  });
  return Number(value ?? 18);
}

export async function readTokenBalance(owner: Address, tokenAddress: Address): Promise<bigint> {
  const value = await readContract(wagmiConfig, {
    address: tokenAddress,
    abi: PuvexaFIXAIAbi,
    functionName: "balanceOf",
    args: [owner],
  });
  return value ?? BigInt(0);
}

export async function readTokenAllowance(owner: Address, spender: Address, tokenAddress: Address): Promise<bigint> {
  const value = await readContract(wagmiConfig, {
    address: tokenAddress,
    abi: PuvexaFIXAIAbi,
    functionName: "allowance",
    args: [owner, spender],
  });
  return value ?? BigInt(0);
}

export async function approveTokens(spender: Address, amount: bigint, tokenAddress: Address): Promise<Hash> {
  try {
    return await writeContract(wagmiConfig, {
      address: tokenAddress,
      abi: PuvexaFIXAIAbi,
      functionName: "approve",
      args: [spender, amount],
    });
  } catch (error) {
    throw describeWeb3Error(error);
  }
}

export async function approveUnlimited(spender: Address, tokenAddress: Address): Promise<Hash> {
  return approveTokens(spender, MAX_UINT256, tokenAddress);
}

export interface ClaimStruct {
  claimId: Hash;
  recipient: Address;
  amount: bigint;
  deadline: bigint;
}

export async function submitClaim(claim: ClaimStruct, signature: Hash, distributorAddress: Address): Promise<Hash> {
  try {
    return await writeContract(wagmiConfig, {
      address: distributorAddress,
      abi: RewardDistributorAbi,
      functionName: "claim",
      args: [
        { claimId: claim.claimId, recipient: claim.recipient, amount: claim.amount, deadline: claim.deadline },
        signature,
      ],
    });
  } catch (error) {
    throw describeWeb3Error(error);
  }
}

export async function submitStake(contributionId: Hash, amount: bigint, vaultAddress: Address): Promise<Hash> {
  try {
    return await writeContract(wagmiConfig, {
      address: vaultAddress,
      abi: ContributionStakeVaultAbi,
      functionName: "stake",
      args: [contributionId, amount],
    });
  } catch (error) {
    throw describeWeb3Error(error);
  }
}

export async function waitForReceipt(hash: Hash): Promise<{ status: "success" | "reverted"; blockNumber: bigint | null }> {
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  return { status: receipt.status, blockNumber: receipt.blockNumber };
}

export function toHex32(value: string): Hash {
  const cleaned = value.startsWith("0x") ? value.slice(2) : value;
  return `0x${cleaned.padStart(64, "0")}` as Hash;
}

export function amountToWei(amountDecimal: number, decimals = 18): bigint {
  return BigInt(Math.round(amountDecimal * 10 ** decimals));
}