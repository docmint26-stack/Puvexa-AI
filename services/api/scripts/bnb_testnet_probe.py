r"""BNB Testnet (chain 97) readiness probe — reports exactly what is/ isn't wired.

Reads only booleans and URL presence from settings; never prints any key material.
Run from services/api with the .venv:
  .\.venv\Scripts\python.exe scripts\bnb_testnet_probe.py
Exit 0 when deployment + claim/stake/royalty input wiring is complete (per README
list), else 1 with the exact missing items (honest BLOCKED report).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.core.config import get_settings  # noqa: E402


def main() -> int:
    s = get_settings()
    print("BNB readiness probe (chain:", s.web3_chain_id, ")")
    missing: list[str] = []

    if not s.web3_claim_enabled:
        missing.append("web3_claim_enabled (claims/stakes offline by design)")

    rpc = bool(s.web3_testnet_rpc_url)
    print(f"  RPC configured: {'ya' if rpc else 'no'}", flush=True)
    if rpc:
        try:
            with httpx.Client(timeout=10) as c:
                r = c.post(
                    s.web3_testnet_rpc_url,
                    json={"jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": []},
                )
                chain = int(r.json().get("result", "0x0"), 16)
                r2 = c.post(
                    s.web3_testnet_rpc_url,
                    json={"jsonrpc": "2.0", "id": 2, "method": "eth_blockNumber", "params": []},
                )
                block = int(r2.json().get("result", "0x0"), 16)
            print(f"  RPC reachable: yes (chain {chain}, block {block})", flush=True)
            if chain != 97:
                missing.append(f"RPC answered chain {chain}, expected 97")
        except Exception as e:
            print(f"  RPC reachable: no ({type(e).__name__})", flush=True)
            missing.append("web3_testnet_rpc_url unreachable")
    else:
        missing.append("web3_testnet_rpc_url (BNB Testnet RPC)")

    for field in ("web3_token_address", "web3_distributor_address", "web3_stake_vault_address", "web3_registry_address"):
        if not getattr(s, field):
            missing.append(f"{field} (deployed address)")

    if not s.web3_reward_signer_private_key:
        missing.append("web3_reward_signer_private_key (offline claim signer)")
    if s.wallet_signature_verifier not in ("eip191",):
        missing.append(f"wallet_signature_verifier='{s.wallet_signature_verifier or 'none'}' (must be 'eip191' to accept browser MetaMask sigs)")

    if s.allow_mainnet_deployment:
        missing.append("allow_mainnet_deployment must remain False (MAINNET disabled)")

    print(f"\nBNB readiness: {'READY' if not missing else 'BLOCKED'}")
    for m in missing:
        print(f"  BLOCKED: {m}")
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())