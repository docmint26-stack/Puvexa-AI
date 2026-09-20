import { injected, createConfig, createStorage, noopStorage, http, type Config } from "wagmi";
import { defineChain } from "viem";
import { web3Config } from "./config";

const SAFE_CHAIN_ID = web3Config.chainId > 0 ? web3Config.chainId : 31337;
const SAFE_RPC_URL = web3Config.rpcUrl || "http://127.0.0.1:8545";

export const web3Chain = defineChain({
  id: SAFE_CHAIN_ID,
  name: web3Config.network || "Local",
  nativeCurrency: { name: "Anvil Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [SAFE_RPC_URL] },
    public: { http: [SAFE_RPC_URL] },
  },
  ...(web3Config.explorerUrl
    ? { blockExplorers: { default: { name: "Explorer", url: web3Config.explorerUrl } } }
    : {}),
});

const noopStorageImpl = createStorage({
  storage: noopStorage,
});

export const wagmiConfig: Config = createConfig({
  chains: [web3Chain],
  connectors: [injected()],
  transports: { [web3Chain.id]: http(SAFE_RPC_URL) },
  storage: noopStorageImpl,
  ssr: true,
});

export function injectedConnector() {
  return wagmiConfig.connectors[0];
}