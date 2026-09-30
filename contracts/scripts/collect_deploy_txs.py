#!/usr/bin/env python3
"""Merge forge broadcast receipts into the deployment artifact.

`forge script ... --broadcast` writes the real transaction hashes to
`broadcast/Deploy.s.sol/<chainId>/run-latest.json`, but the Solidity script can only write the
addresses/roles it computes. This helper joins the two so the final artifact (default
`deployments/bnb-testnet.json`) carries verifiable deployment transaction hashes and blocks.

Usage (from the contracts/ directory):

    python scripts/collect_deploy_txs.py --chain 97 --artifact deployments/bnb-testnet.json

Exit codes: 0 = artifact enriched, 1 = blocked (missing broadcast record / mismatched addresses).
No key material is read or written.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CONTRACTS_DIR = Path(__file__).resolve().parents[1]

# forge contractName -> artifact key
NAME_TO_KEY = {
    "PuvexaFIXAI": "token",
    "ContributionRegistry": "registry",
    "ContributionStakeVault": "stakeVault",
    "RewardDistributor": "distributor",
}
CALL_TO_KEY = {
    ("PuvexaFIXAI", "transfer"): "funding",
}


def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"BLOCKED: {path} not found", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"BLOCKED: {path} is not valid JSON ({exc})", file=sys.stderr)
        sys.exit(1)


def _tx_label(transaction: dict) -> str | None:
    kind = (transaction.get("transactionType") or "").upper()
    name = transaction.get("contractName") or ""
    if kind == "CREATE":
        return NAME_TO_KEY.get(name)
    if kind == "CALL":
        inputs = transaction.get("transactionArguments") or ""
        selector = (transaction.get("function") or "").split("(")[0]
        if name and selector:
            return CALL_TO_KEY.get((name, selector))
        if name == "PuvexaFIXAI" and "transfer" in str(inputs):
            return "funding"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge forge broadcast txs into a deployment artifact.")
    parser.add_argument("--chain", type=int, default=None, help="chain id (default: artifact chainId)")
    parser.add_argument("--artifact", default="deployments/bnb-testnet.json")
    parser.add_argument("--broadcast", default=None, help="path to run-latest.json (default: derived from --chain)")
    args = parser.parse_args()

    artifact_path = Path(args.artifact)
    if not artifact_path.is_absolute():
        artifact_path = CONTRACTS_DIR / artifact_path
    if not artifact_path.exists():
        print(f"BLOCKED: artifact {artifact_path} not found — run `forge script` first", file=sys.stderr)
        return 1

    artifact = _load(artifact_path)
    chain_id = args.chain or int(artifact.get("chainId") or 0)
    if not chain_id:
        print("BLOCKED: chain id unknown (pass --chain or set artifact.chainId)", file=sys.stderr)
        return 1

    broadcast_path = Path(args.broadcast) if args.broadcast else CONTRACTS_DIR / "broadcast" / "Deploy.s.sol" / str(chain_id) / "run-latest.json"
    if not broadcast_path.exists():
        print(
            f"BLOCKED: no broadcast record at {broadcast_path}. "
            "Deployment transaction hashes cannot be reported for an un-broadcast deployment.",
            file=sys.stderr,
        )
        return 1

    broadcast = _load(broadcast_path)
    transactions = broadcast.get("transactions") or []
    receipts = broadcast.get("receipts") or []
    if len(transactions) != len(receipts):
        print(
            f"BLOCKED: broadcast record has {len(transactions)} transactions but {len(receipts)} receipts",
            file=sys.stderr,
        )
        return 1

    txs: dict[str, str] = {}
    blocks: dict[str, int] = {}
    for transaction, receipt in zip(transactions, receipts):
        if str(receipt.get("status", "0x1")) not in ("0x1", "1"):
            print(f"BLOCKED: reverted broadcast transaction {receipt.get('transactionHash')}", file=sys.stderr)
            return 1
        label = _tx_label(transaction)
        if not label:
            continue
        receipt_contract = (receipt.get("contractAddress") or "").lower()
        target = (receipt.get("to") or "").lower()
        expected = str(artifact.get(label if label != "funding" else "token") or "").lower()
        if label != "funding" and receipt_contract and expected and receipt_contract != expected:
            print(
                f"BLOCKED: broadcast creates {receipt_contract} for '{label}' but the artifact holds {expected} "
                "— the broadcast record is from a different deployment",
                file=sys.stderr,
            )
            return 1
        if label == "funding" and expected and target and target != expected:
            print(f"BLOCKED: funding transaction targets {target}, artifact token is {expected}", file=sys.stderr)
            return 1
        txs[label] = receipt["transactionHash"]
        blocks[label] = int(receipt["blockNumber"], 16)

    required = {"token", "registry", "stakeVault", "distributor"}
    missing = sorted(required - txs.keys())
    if missing:
        print(f"BLOCKED: broadcast record is missing CREATE entries for: {', '.join(missing)}", file=sys.stderr)
        return 1

    artifact["deploymentTx"] = txs
    artifact["deploymentBlocks"] = blocks
    artifact.setdefault("deploymentBlock", min(blocks.values()))
    artifact_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")

    print(f"artifact updated: {artifact_path}")
    for key, value in txs.items():
        print(f"  {key:12} {value} (block {blocks[key]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
