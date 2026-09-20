import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletChallenge, WalletProvider, WalletState } from "@/lib/demo/types";
import { PERSIST_KEYS, jsonStorage } from "@/lib/state/storage";
import { shortAddress } from "@/lib/format";

const DEMO_ADDRESS = "0x72A391fD0d3c8b45E7F90a2B4cC1e89d6A5041F".toLowerCase();
const DEMO_SHORT = "0x72A...91F";

type Status = WalletState["status"];

interface WalletStore extends WalletState {
  connect: (provider: WalletProvider) => Promise<Status>;
  disconnect: () => void;
  simulateNetworkMismatch: () => void;
  markVerified: () => void;
  fail: (message: string) => void;
  setConnecting: (provider: WalletProvider) => void;
  setConnected: (address: string, chainId: number | null, network: string, provider?: WalletProvider) => void;
  setWrongNetwork: (expected: number, actual: number | null) => void;
  setVerifying: () => void;
  setChallenge: (challenge: WalletChallenge | null) => void;
  setChainId: (chainId: number) => void;
  setLastError: (message?: string) => void;
  resolveError: () => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      status: "disconnected",
      provider: null,
      address: null,
      shortAddress: null,
      network: "FIX Demo · Testnet",
      lastError: undefined,
      chainId: null,
      verifiedAt: null,
      challenge: null,

      connect: async (provider) => {
        set({ status: "connecting", provider, lastError: undefined });
        await delay(700);
        set({ status: "connected", address: DEMO_ADDRESS, shortAddress: DEMO_SHORT, network: "FIX Demo · Testnet", chainId: 0 });
        await delay(500);
        set({ status: "verifying" });
        await delay(500);
        set({ status: "verified", verifiedAt: new Date().toISOString() });
        return "verified" as Status;
      },

      disconnect: () =>
        set({
          status: "disconnected",
          provider: null,
          address: null,
          shortAddress: null,
          network: "FIX Demo · Testnet",
          lastError: undefined,
          chainId: null,
          verifiedAt: null,
          challenge: null,
        }),

      simulateNetworkMismatch: () => set({ status: "wrong-network", lastError: "Wallet is on the wrong network." }),

      markVerified: () => set({ status: "verified", lastError: undefined, verifiedAt: new Date().toISOString() }),

      fail: (message) => set({ status: "error", lastError: message }),

      setConnecting: (provider) => set({ status: "connecting", provider, lastError: undefined }),

      setConnected: (address, chainId, network, provider) =>
        set({
          status: "connected",
          address,
          shortAddress: shortAddress(address),
          chainId,
          network,
          provider: provider ?? "MetaMask",
          lastError: undefined,
        }),

      setWrongNetwork: (expected, actual) =>
        set({
          status: "wrong-network",
          chainId: actual,
          lastError: `Connected to chain ${actual ?? "unknown"}; Puvexa expects chain ${expected}.`,
        }),

      setVerifying: () => set({ status: "verifying", lastError: undefined }),

      setChallenge: (challenge) => set({ challenge }),

      setChainId: (chainId) => set({ chainId }),

      setLastError: (message) => set({ lastError: message }),

      resolveError: () =>
        set((s) =>
          s.address
            ? { status: "connected", lastError: undefined }
            : { status: "disconnected", lastError: undefined }
        ),
    }),
    {
      name: PERSIST_KEYS.wallet,
      storage: jsonStorage(),
      partialize: (s) => ({
        status: s.status,
        provider: s.provider,
        address: s.address,
        shortAddress: s.shortAddress,
        network: s.network,
        lastError: s.lastError,
        chainId: s.chainId,
        verifiedAt: s.verifiedAt,
        challenge: s.challenge,
      }),
    }
  )
);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}