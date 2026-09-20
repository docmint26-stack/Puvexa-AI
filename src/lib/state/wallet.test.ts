import { beforeEach, describe, expect, it } from "vitest";

import { useWalletStore } from "./wallet";

const ADDRESS = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

beforeEach(() => {
  useWalletStore.getState().disconnect();
});

describe("wallet store states", () => {
  it("starts disconnected", () => {
    const s = useWalletStore.getState();
    expect(s.status).toBe("disconnected");
    expect(s.address).toBeNull();
    expect(s.verifiedAt).toBeNull();
  });

  it("marks connecting through connected to verified", () => {
    useWalletStore.getState().setConnecting("MetaMask");
    expect(useWalletStore.getState().status).toBe("connecting");

    useWalletStore.getState().setConnected(ADDRESS, 31337, "Local Anvil");
    const connected = useWalletStore.getState();
    expect(connected.status).toBe("connected");
    expect(connected.shortAddress).toMatch(/^0x8ba1/);
    expect(connected.shortAddress).toContain("…");

    useWalletStore.getState().markVerified();
    expect(useWalletStore.getState().status).toBe("verified");
    expect(useWalletStore.getState().verifiedAt).toBeTruthy();
  });

  it("flags a wrong network while keeping the offending chain id", () => {
    useWalletStore.getState().setConnected(ADDRESS, 31337, "Local Anvil");
    useWalletStore.getState().setWrongNetwork(31337, 11155111);
    const s = useWalletStore.getState();
    expect(s.status).toBe("wrong-network");
    expect(s.chainId).toBe(11155111);
    expect(s.lastError).toContain("31337");
  });

  it("stores failures and resolves back to a known address", () => {
    useWalletStore.getState().setConnected(ADDRESS, 31337, "Local Anvil");
    useWalletStore.getState().fail("User rejected the signature.");
    expect(useWalletStore.getState().status).toBe("error");
    expect(useWalletStore.getState().lastError).toContain("User rejected");

    useWalletStore.getState().resolveError();
    const s = useWalletStore.getState();
    expect(s.status).toBe("connected");
    expect(s.address).toBe(ADDRESS);
    expect(s.lastError).toBeUndefined();
  });

  it("resolves to disconnected when there is no known address", () => {
    useWalletStore.getState().fail("Connector failed.");
    useWalletStore.getState().resolveError();
    expect(useWalletStore.getState().status).toBe("disconnected");
  });

  it("tracks the pending challenge and chain id", () => {
    useWalletStore.getState().setChainId(31337);
    useWalletStore.getState().setChallenge({ nonce: "n", message: "m", expiresAt: "" });
    const s = useWalletStore.getState();
    expect(s.chainId).toBe(31337);
    expect(s.challenge?.nonce).toBe("n");
  });

  it("clears everything on disconnect", () => {
    useWalletStore.getState().setConnected(ADDRESS, 31337, "Local Anvil");
    useWalletStore.getState().markVerified();
    useWalletStore.getState().disconnect();
    const s = useWalletStore.getState();
    expect(s.status).toBe("disconnected");
    expect(s.address).toBeNull();
    expect(s.verifiedAt).toBeNull();
    expect(s.challenge).toBeNull();
    expect(s.lastError).toBeUndefined();
  });
});