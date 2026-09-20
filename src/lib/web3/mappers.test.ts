import { describe, expect, it } from "vitest";

import {
  amountToWeiString,
  contributionIdBytes32,
  mapClaimReservation,
  mapWalletChallenge,
  mapWeb3Status,
  mapWeb3Transaction,
  normalizeRawAddress,
  shortHash,
  TRANSACTION_TYPE_LABELS,
  weiToDecimal,
  weiToFixed,
} from "./mappers";

describe("wei helpers", () => {
  it("converts wei strings to decimal amounts", () => {
    expect(weiToDecimal("1000000000000000000")).toBe(1);
    expect(weiToDecimal("2500000000000000000")).toBe(2.5);
    expect(weiToDecimal("0")).toBe(0);
  });

  it("converts bigint wei with a custom token decimals count", () => {
    expect(weiToDecimal(BigInt(123456), 2)).toBe(1234.56);
  });

  it("formats wei to a fixed string", () => {
    expect(weiToFixed("125000000000000000", 18, 2)).toBe("0.13");
    expect(weiToFixed(BigInt(0))).toBe("0");
  });

  it("builds a wei string from an amount", () => {
    expect(amountToWeiString(1.5)).toBe("1500000000000000000");
    expect(amountToWeiString(0)).toBe("0");
  });
});

describe("bytes32 helper", () => {
  it("produces a deterministic 32-byte hash for a contribution id", () => {
    const a = contributionIdBytes32("contribution-123");
    const b = contributionIdBytes32("contribution-123");
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("normalizeRawAddress", () => {
  it("lowercases a valid address", () => {
    expect(normalizeRawAddress("0x8ba1f109551bD432803012645Ac136ddd64DBA72")).toBe(
      "0x8ba1f109551bd432803012645ac136ddd64dba72",
    );
  });

  it("rejects malformed and empty input", () => {
    expect(normalizeRawAddress("0x123")).toBeNull();
    expect(normalizeRawAddress("")).toBeNull();
    expect(normalizeRawAddress(null)).toBeNull();
    expect(normalizeRawAddress(undefined)).toBeNull();
  });
});

describe("mapClaimReservation", () => {
  it("maps the raw API shape to a reservation", () => {
    const r = mapClaimReservation({
      claim_id: "claim-1",
      reward_id: "reward-7",
      wallet_address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      token_address: "0x1111111111111111111111111111111111111111",
      contract_address: "0x2222222222222222222222222222222222222222",
      chain_id: 31337,
      amount_wei: "20000000000000000000",
      deadline: 1712345678,
      state: "reserved",
      reserved_at: "2026-09-01T10:00:00Z",
    });
    expect(r.claimId).toBe("claim-1");
    expect(r.rewardId).toBe("reward-7");
    expect(r.amountDecimal).toBe(20);
    expect(r.amountWei).toBe("20000000000000000000");
    expect(r.verifyingContract).toBe("0x2222222222222222222222222222222222222222");
    expect(r.chainId).toBe(31337);
    expect(r.state).toBe("reserved");
    expect(r.txHash).toBeNull();
  });
});

describe("mapWalletChallenge", () => {
  it("maps nonce, message and expiry, defaulting ttl to 15 minutes", () => {
    const c = mapWalletChallenge({
      nonce: "abc123",
      message: "Puvexa wallet verification",
      expires_at: "2026-09-01T10:10:00Z",
    });
    expect(c.nonce).toBe("abc123");
    expect(c.message).toContain("Puvexa wallet verification");
    expect(c.ttlMinutes).toBe(15);
  });

  it("honors an explicit ttl", () => {
    const c = mapWalletChallenge({ nonce: "x", message: "m", expires_at: "", ttl_minutes: 5 });
    expect(c.ttlMinutes).toBe(5);
  });
});

describe("mapWeb3Transaction", () => {
  it("maps type/status/hash and timestamps", () => {
    const t = mapWeb3Transaction({
      id: "tx-1",
      tx_type: "claim",
      status: "confirmed",
      chain_id: 31337,
      tx_hash: "0xabcdef",
      from_address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      created_at: "2026-09-01T11:00:00Z",
    });
    expect(t.id).toBe("tx-1");
    expect(t.type).toBe("claim");
    expect(t.status).toBe("confirmed");
    expect(t.txHash).toBe("0xabcdef");
    expect(t.chainId).toBe(31337);
    expect(t.blockNumber).toBeNull();
    expect(t.confirmedAt).toBeNull();
  });

  it("falls back to confirmed_at for createdAt", () => {
    const t = mapWeb3Transaction({ id: "tx-2", created_at: "", confirmed_at: "2026-09-01T11:00:00Z" });
    expect(t.createdAt).toBe("2026-09-01T11:00:00Z");
  });
});

describe("mapWeb3Status", () => {
  it("maps status flags and contract addresses", () => {
    const s = mapWeb3Status({
      claim_enabled: true,
      chain_id: 31337,
      network: "Local Anvil",
      token_address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      rpc_configured: true,
      connected: true,
    });
    expect(s.enabled).toBe(true);
    expect(s.claimEnabled).toBe(true);
    expect(s.rpcConfigured).toBe(true);
    expect(s.tokenAddress).toBe("0x8ba1f109551bd432803012645ac136ddd64dba72");
    expect(s.chainId).toBe(31337);
  });
});

describe("labels and short hashes", () => {
  it("labels known transaction types", () => {
    expect(TRANSACTION_TYPE_LABELS.claim).toBe("Reward claim");
    expect(TRANSACTION_TYPE_LABELS.stake_release).toBe("Stake released");
  });

  it("shortens hashes with an ellipsis", () => {
    const h = shortHash("0x1234567890abcdef1234567890abcdef");
    expect(h).toContain("…");
    expect(h).toHaveLength(17);
    expect(h.startsWith("0x12345678")).toBe(true);
    expect(h.endsWith("cdef")).toBe(true);
  });

  it("returns an empty string for a missing hash", () => {
    expect(shortHash(null)).toBe("");
  });
});