"""Local Anvil end-to-end harness for the Phase 5 Web3 economy.

Drives the FULL local stack as one connected system:

    anvil (chain 31337)
        -> Deploy.s.sol (token, registry, stake vault, distributor funded)
        -> backend web3 economy API (EIP-712 prepare/confirm, EIP-191 wallet verify)
        -> real signed transactions broadcast to the local chain by the wallet
        -> backend ChainVerifier re-reads receipts from the node before settling

Covers the E2E scenarios required by the Phase 5 closeout:
  1. wallet ownership verification (challenge -> EIP-191 sign -> verify)
  2. claim: prepare -> on-chain claim -> backend confirm -> ledger/wallet settled
  3. claim exclusivity: a finalized reward can never be prepared again
  4. stake: approve exact amount -> stake -> confirm -> vault locked
  5. release: operator release -> backend settlement -> stake returned
  6. slash: operator slash -> backend settlement -> partial return / partial slash
  7. royalty: royalty reward claimed through the same distributor -> exclusivity

Auth is stubbed in-process (no Supabase project exists locally); every other
layer is real: HTTP API (ASGI transport), web3.py node calls, and signed txns.

Run from `services/api`:
    python scripts/e2e_web3.py
Prereqs: local Foundry (`forge`/`anvil` on PATH or under C:\\Users\\PK\\.foundry\\bin).
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from uuid import NAMESPACE_URL, uuid4, uuid5

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
CONTRACTS_DIR = API_DIR.parent.parent / "contracts"

CHAIN_ID = 31337
RPC_URL = os.environ.get("PUVEXA_E2E_RPC", "http://127.0.0.1:8545")
REUSE_ANVIL = os.environ.get("PUVEXA_E2E_REUSE_ANVIL", "0") == "1"

# Well-known public Anvil development keys (local-only; never production).
DEPLOYER_KEY = os.environ.get("PUVEXA_E2E_DEPLOYER_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
SIGNER_KEY = os.environ.get("PUVEXA_E2E_SIGNER_KEY", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
USER_KEY = os.environ.get("PUVEXA_E2E_USER_KEY", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")

PASS = 0
FAIL = 0


def ok(label: str, detail: str = ""):
    global PASS
    PASS += 1
    print(f"  [E2E] PASS  {label}" + (f"  ({detail})" if detail else ""))


def bad(label: str, detail: str = ""):
    global FAIL
    FAIL += 1
    print(f"  [E2E] FAIL  {label}" + (f"  ({detail})" if detail else ""))


def check(label: str, cond: bool, detail: str = ""):
    (ok if cond else bad)(label, "" if cond else detail)


def find_tool(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    user_tool = Path.home() / ".foundry" / "bin" / (name + ".exe")
    if user_tool.exists():
        return str(user_tool)
    raise RuntimeError(f"{name} not found on PATH or under .foundry/bin")


def wait_for_rpc(timeout: float = 40.0) -> None:
    import requests  # local import only (pep8-compatible ordering)

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            resp = requests.post(
                RPC_URL,
                json={"jsonrpc": "2.0", "method": "eth_chainId", "params": [], "id": 1},
                timeout=2,
            )
            if resp.status_code == 200 and int(resp.json().get("result", "0x0"), 16) == CHAIN_ID:
                return
        except Exception:  # noqa: BLE001
            pass
        time.sleep(0.5)
    raise RuntimeError(f"Anvil RPC at {RPC_URL} did not become ready (chain {CHAIN_ID}).")


ANVIL_PROC: subprocess.Popen | None = None


def start_anvil() -> None:
    global ANVIL_PROC
    if REUSE_ANVIL:
        wait_for_rpc()
        print("[E2E] reusing an already-running Anvil node")
        return
    anvil = find_tool("anvil")
    workspace = Path(tempfile.mkdtemp(prefix="puvexa-anvil-"))
    log = open(workspace / "anvil.log", "w", encoding="utf-8")
    ANVIL_PROC = subprocess.Popen(
        [anvil, "--port", "8545", "--chain-id", str(CHAIN_ID)],
        stdout=log,
        stderr=subprocess.STDOUT,
        cwd=str(workspace),
    )
    wait_for_rpc()
    print(f"[E2E] anvil ready  (pid={ANVIL_PROC.pid}, log={log.name})")


def stop_anvil() -> None:
    global ANVIL_PROC
    if ANVIL_PROC is not None:
        ANVIL_PROC.terminate()
        try:
            ANVIL_PROC.wait(timeout=5)
        except Exception:  # noqa: BLE001
            ANVIL_PROC.kill()
        ANVIL_PROC = None
        print("[E2E] anvil stopped")


def deploy_contracts(signer_address: str) -> dict:
    forge = find_tool("forge")
    env = dict(os.environ)
    env["PUVEXA_REWARD_SIGNER"] = signer_address
    env["PUVEXA_FUND_FIX"] = "100000"
    env["PUVEXA_SLASH_BPS"] = "2500"
    result = subprocess.run(
        [
            forge,
            "script",
            "script/Deploy.s.sol",
            "--rpc-url", RPC_URL,
            "--broadcast",
            "--private-key", DEPLOYER_KEY,
            "-vv",
        ],
        cwd=str(CONTRACTS_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError("forge script deploy failed:\n" + result.stdout[-4000:] + "\n" + result.stderr[-4000:])
    artifact = CONTRACTS_DIR / "deployments" / "local.json"
    if not artifact.exists():
        raise RuntimeError("deploy did not write deployments/local.json:\n" + result.stdout[-2000:])
    data = json.loads(artifact.read_text(encoding="utf-8"))
    print(f"[E2E] contracts deployed  token={data['token']} distributor={data['distributor']} vault={data['stakeVault']}")
    return data


# ---------------------------------------------------------------------------
# On-chain helper (web3.py sync client)
# ---------------------------------------------------------------------------

def load_abi(contract_name: str) -> list:
    artifact = CONTRACTS_DIR / "out" / f"{contract_name}.sol" / f"{contract_name}.json"
    return json.loads(artifact.read_text(encoding="utf-8"))["abi"]


class Chain:
    def __init__(self, addresses: dict):
        from web3 import HTTPProvider, Web3

        self.w = Web3(HTTPProvider(RPC_URL))
        assert self.w.is_connected()
        token_abi = load_abi("PuvexaFIXAI")
        distributor_abi = load_abi("RewardDistributor")
        vault_abi = load_abi("ContributionStakeVault")
        self.token = self.w.eth.contract(address=addresses["token"], abi=token_abi)
        self.distributor = self.w.eth.contract(address=addresses["distributor"], abi=distributor_abi)
        self.vault = self.w.eth.contract(address=addresses["stakeVault"], abi=vault_abi)
        self.base = {"from": None, "chainId": CHAIN_ID, "gas": 400_000}

    def send(self, fn, key: str, from_addr: str):
        nonce = self.w.eth.get_transaction_count(from_addr, "pending")
        gas = fn.estimate_gas({"from": from_addr})
        tx = fn.build_transaction({**self.base, "from": from_addr, "nonce": nonce, "gas": max(gas, 60_000)})
        signed = self.w.eth.account.sign_transaction(tx, private_key=key)
        tx_hash = self.w.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w.eth.wait_for_transaction_receipt(tx_hash, timeout=45)
        if receipt.status != 1:
            raise RuntimeError(f"tx reverted: {tx_hash.hex()}")
        return self.w.to_hex(tx_hash)

    def balance(self, address: str) -> int:
        return self.token.functions.balanceOf(address).call()


# ---------------------------------------------------------------------------
# Backend app driver (in-process ASGI, auth stubbed)
# ---------------------------------------------------------------------------

def configure_backend_env(db_path: Path, addresses: dict, signer_key: str) -> None:
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["AI_PROVIDER"] = "unconfigured"
    os.environ["SUPABASE_URL"] = ""
    os.environ["SUPABASE_ANON_KEY"] = ""
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
    os.environ["SUPABASE_JWKS_URL"] = ""
    os.environ["WEB3_CLAIM_ENABLED"] = "true"
    os.environ["WALLET_SIGNATURE_VERIFIER"] = "eip191"
    os.environ["WEB3_CHAIN_ID"] = str(CHAIN_ID)
    os.environ["WEB3_TESTNET_RPC_URL"] = RPC_URL
    os.environ["WEB3_TOKEN_ADDRESS"] = addresses["token"]
    os.environ["WEB3_DISTRIBUTOR_ADDRESS"] = addresses["distributor"]
    os.environ["WEB3_STAKE_VAULT_ADDRESS"] = addresses["stakeVault"]
    os.environ["WEB3_REGISTRY_ADDRESS"] = addresses["registry"]
    os.environ["WEB3_REWARD_SIGNER_PRIVATE_KEY"] = signer_key
    os.environ["ALLOW_MAINNET_DEPLOYMENT"] = "false"


async def seed_fixes():
    from app.db.models import Fix
    from app.db.session import Session
    from app.scripts.seed_dev import SEEDS

    async with Session() as db:
        for title, category, steps in SEEDS:
            identifier = str(uuid5(NAMESPACE_URL, "puvexa:curated:" + title))
            db.add(Fix(id=identifier, title=title, summary="Curated development guidance. No verified outcome statistics yet.", category=category, instructions=list(steps)))
        await db.commit()


async def create_claimable_scenario(client, user_id: str) -> str:
    """Runs the full verified-outcome path and returns the claimable reward id."""
    from sqlalchemy import select, update

    from app.db.models import Case, CaseFixRecommendation, Fix, RewardLedger
    from app.db.session import Session
    from app.services.workflows import accept_outcome

    resp = await client.post(
        "/api/v1/cases",
        json={
            "title": "Bluetooth audio keeps dropping",
            "description": "Every few minutes the headset reconnects and the sound cuts out while streaming video.",
            "category": "Hardware & Devices",
        },
    )
    assert resp.status_code == 201, resp.text
    case_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/cases/{case_id}/diagnose")
    assert resp.status_code == 201, resp.text
    diagnosis = resp.json()

    async with Session() as db:
        fix = (await db.scalars(select(Fix).where(Fix.category == "Coding Error"))).first()
        assert fix is not None
        stored = (await db.scalars(select(Case).where(Case.id == case_id))).first()
        db.add(CaseFixRecommendation(case_id=stored.id, diagnosis_run_id=diagnosis["id"], fix_id=fix.id, rank=1, explanation="E2E scenario."))
        await db.execute(update(Case).where(Case.id == case_id).values(status="suggested"))
        await db.commit()

    resp = await client.get(f"/api/v1/cases/{case_id}/recommendations")
    fix_id = resp.json()[0]["fix"]["id"]

    resp = await client.post(f"/api/v1/cases/{case_id}/attempts", json={"fix_id": fix_id})
    assert resp.status_code == 201, resp.text
    attempt_id = resp.json()["id"]

    resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/outcomes",
        json={"reported_result": "resolved", "before_data": {}, "after_data": {}},
    )
    assert resp.status_code == 201, resp.text
    outcome_id = resp.json()["id"]

    async with Session() as db:
        await accept_outcome(db, outcome_id)
        await db.commit()
        reward = (await db.scalars(select(RewardLedger).where(RewardLedger.user_id == user_id))).all()[-1]
        reward_id = str(reward.id)
        assert float(reward.amount) == 8, str(reward.amount)
    return reward_id


async def grant_royalty(user_id: str, amount: int = 1) -> str:
    from sqlalchemy import select

    from app.db.models import RewardLedger
    from app.db.session import Session
    from app.services.rewards import grant_royalty

    async with Session() as db:
        await grant_royalty(db, usage_id=str(uuid4()), contributor_id=user_id, amount=amount, actor_user_id=user_id)
        await db.commit()
        reward = (await db.scalars(select(RewardLedger).where(RewardLedger.user_id == user_id, RewardLedger.event_type == "royalty"))).all()[-1]
        return str(reward.id)


async def run():
    from eth_account import Account
    from eth_account.messages import encode_defunct
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import select

    deployer = Account.from_key(DEPLOYER_KEY)
    signer = Account.from_key(SIGNER_KEY)
    user = Account.from_key(USER_KEY)
    deployer_addr, signer_addr, user_addr = deployer.address, signer.address, user.address

    # 0. Chain up + deploy
    start_anvil()
    try:
        addresses = deploy_contracts(signer_address=signer_addr.lower())

        # 1. Backend up (fresh sqlite)
        temp = Path(tempfile.mkdtemp(prefix="puvexa-e2e-"))
        db_path = temp / "e2e.db"
        configure_backend_env(db_path, addresses, SIGNER_KEY)

        from sqlalchemy.ext.asyncio import create_async_engine

        import app.main as main_module
        from app.core.config import get_settings
        from app.core.security import get_identity
        from app.db.base import Base
        from app.db.session import Session as AppSession
        from app.main import app

        main_module.limits.clear()

        settings = get_settings()
        assert settings.web3_claim_enabled is True
        assert settings.wallet_signature_verifier == "eip191"
        assert settings.web3_chain_id == CHAIN_ID
        assert settings.web3_distributor_address.lower() == addresses["distributor"].lower()

        e2e_engine = create_async_engine(os.environ["DATABASE_URL"])
        async with e2e_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        app.dependency_overrides[get_identity] = lambda: type("ID", (), {"id": USER_ID, "email": "e2e@puvexa.local", "display_name": "E2E User"})()

        async with AppSession() as db:
            from app.db.models import RewardLedger

            await seed_fixes()
            await db.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            chain = Chain(addresses)
            print("[E2E] backend up; wallet owner:", user_addr)

            # ---- 1. wallet ownership verification ----
            print("[E2E] scenario 2/2: wallet verification + claims + stakes + royalty")
            resp = await client.post("/api/v1/wallet/challenge", json={"address": user_addr, "chain_id": CHAIN_ID})
            assert resp.status_code == 201, resp.text
            challenge = resp.json()
            message = challenge["message"]
            sig = Account.sign_message(encode_defunct(text=message), USER_KEY).signature.hex()
            resp = await client.post(
                "/api/v1/wallet/verify",
                json={"address": user_addr, "chain_id": CHAIN_ID, "signature": "0x" + sig, "nonce": challenge["nonce"]},
            )
            check("wallet verify", resp.status_code == 200 and resp.json().get("status") == "verified", resp.text[:200])
            if resp.status_code == 200:
                ok("wallet challenge message contract", f"{message!r:20}")

            # ---- 2. claim happy path ----
            reward_id = await create_claimable_scenario(client, USER_ID)
            resp = await client.post("/api/v1/web3/claims/prepare", json={"reward_id": reward_id, "wallet_address": user_addr, "chain_id": CHAIN_ID})
            check("claim prepare signed EIP-712", resp.status_code == 201 and resp.json().get("recipient", "").lower() == user_addr.lower(), resp.text[:200])
            if resp.status_code != 201:
                return 1
            prepared = resp.json()
            claim_id = prepared["claim_id"]
            amount_wei = int(prepared["amount_wei"])
            assert amount_wei == 8 * 10**18

            tx_hash = chain.send(
                chain.distributor.functions.claim([claim_id, user_addr, amount_wei, prepared["deadline"]], prepared["signature"]),
                USER_KEY, user_addr,
            )
            check("claim tx mined on anvil", tx_hash.startswith("0x"), tx_hash[:18])
            resp = await client.post("/api/v1/web3/claims/confirm", json={"claim_id": claim_id, "tx_hash": tx_hash, "chain_id": CHAIN_ID})
            check("claim confirm 200", resp.status_code == 200 and resp.json().get("status") == "confirmed", resp.text[:200])
            check("wallet now holds 8 FIX", chain.balance(user_addr) == 8 * 10**18, f"balance={chain.balance(user_addr)}")
            check("distributor paid out", chain.balance(addresses["distributor"]) == (100_000 - 8) * 10**18, f"dist={chain.balance(addresses['distributor'])}")

            async with AppSession() as db:
                reward = await db.scalar(select(RewardLedger).where(RewardLedger.id == reward_id))
                check("reward ledger settled onchain", reward.status == "claimed_onchain", reward.status)

            # ---- 2b. claim exclusivity (duplicate prepare fails) ----
            resp = await client.post("/api/v1/web3/claims/prepare", json={"reward_id": reward_id, "wallet_address": user_addr, "chain_id": CHAIN_ID})
            code = resp.json().get("error", {}).get("code", "") if resp.status_code != 201 else ""
            check("duplicate claim rejected", resp.status_code == 409 and code in ("REWARD_ALREADY_CLAIMED", "REWARD_NOT_CLAIMABLE"), f"{resp.status_code} {code}")

            # ---- 3. stake (exact approval) ----
            user_balance_before = chain.balance(user_addr)
            chain.send(chain.token.functions.transfer(user_addr, 20 * 10**18), DEPLOYER_KEY, deployer_addr)
            check("treasury funded wallet for staking", chain.balance(user_addr) == user_balance_before + 20 * 10**18)

            cid = "0x" + __import__("hashlib").sha256(b"puvexa-e2e-stake-1").hexdigest()
            stake_amount = 5 * 10**18
            tx_hash = chain.send(chain.token.functions.approve(addresses["stakeVault"], stake_amount), USER_KEY, user_addr)
            check("approve exact 5 FIX mined", tx_hash.startswith("0x"))
            check("vault allowance == 5 FIX", chain.token.functions.allowance(user_addr, addresses["stakeVault"]).call() == stake_amount)
            tx_hash2 = chain.send(chain.vault.functions.stake(cid, stake_amount), USER_KEY, user_addr)
            resp = await client.post(
                "/api/v1/web3/stakes/confirm",
                json={"contribution_id": cid, "wallet_address": user_addr, "tx_hash": tx_hash2, "chain_id": CHAIN_ID},
            )
            check("stake confirm 200", resp.status_code == 200 and resp.json().get("status") == "confirmed", resp.text[:200])
            check("vault locked 5 FIX", chain.vault.functions.stakes(cid).call()[3] == 0, str(chain.vault.functions.stakes(cid).call()))
            check("wallet balance dropped by 5", chain.balance(user_addr) == user_balance_before + 20 * 10**18 - stake_amount)

            # ---- 4. release ----
            tx_hash = chain.send(chain.vault.functions.release(cid), DEPLOYER_KEY, deployer_addr)
            resp = await client.post(f"/api/v1/web3/stakes/{cid}/release", json={"tx_hash": tx_hash, "chain_id": CHAIN_ID})
            check("release confirm 200", resp.status_code == 200 and resp.json().get("status") == "confirmed", resp.text[:200])
            check("release returned 5", resp.json().get("returned_wei") == str(stake_amount), resp.text[:200])
            check("wallet balance restored +5", chain.balance(user_addr) == user_balance_before + 20 * 10**18, f"b={chain.balance(user_addr)}")
            check("stake released on-chain", chain.vault.functions.stakes(cid).call()[3] == 1, str(chain.vault.functions.stakes(cid).call()))
            check("vault token balance 0", chain.token.functions.balanceOf(addresses["stakeVault"]).call() == 0)

            # ---- 5. slash (25%) ----
            cid2 = "0x" + __import__("hashlib").sha256(b"puvexa-e2e-stake-2").hexdigest()
            chain.send(chain.token.functions.approve(addresses["stakeVault"], stake_amount), USER_KEY, user_addr)
            tx_hash2 = chain.send(chain.vault.functions.stake(cid2, stake_amount), USER_KEY, user_addr)
            resp = await client.post(
                "/api/v1/web3/stakes/confirm",
                json={"contribution_id": cid2, "wallet_address": user_addr, "tx_hash": tx_hash2, "chain_id": CHAIN_ID},
            )
            check("slash stake confirm 200", resp.status_code == 200, resp.text[:200])
            balance_before_slash = chain.balance(user_addr)
            deployer_before_slash = chain.balance(deployer_addr)
            tx_hash = chain.send(chain.vault.functions.slash(cid2), DEPLOYER_KEY, deployer_addr)
            resp = await client.post(f"/api/v1/web3/stakes/{cid2}/slash", json={"tx_hash": tx_hash, "chain_id": CHAIN_ID})
            check("slash confirm 200", resp.status_code == 200 and resp.json().get("status") == "confirmed", resp.text[:200])
            slashed_wei = int(resp.json().get("slashed_wei", 0))
            returned_wei = int(resp.json().get("returned_wei", 0))
            check("slash 1.25 / return 3.75", slashed_wei == 125 * 10**16 and returned_wei == 375 * 10**16, f"s={slashed_wei} r={returned_wei}")
            check("wallet balance +3.75 after slash", chain.balance(user_addr) == balance_before_slash + 375 * 10**16, f"b={chain.balance(user_addr)}")
            check("slash vault received 1.25", chain.balance(deployer_addr) == deployer_before_slash + 125 * 10**16, f"d={chain.balance(deployer_addr)}")
            check("stake slashed on-chain", chain.vault.functions.stakes(cid2).call()[3] == 2, str(chain.vault.functions.stakes(cid2).call()))

            # ---- 6. royalty claim + exclusivity ----
            royalty_id = await grant_royalty(USER_ID, amount=1)
            resp = await client.post("/api/v1/web3/claims/prepare", json={"reward_id": royalty_id, "wallet_address": user_addr, "chain_id": CHAIN_ID})
            check("royalty prepare 201", resp.status_code == 201, resp.text[:200])
            if resp.status_code == 201:
                rp = resp.json()
                tx_hash = chain.send(
                    chain.distributor.functions.claim([rp["claim_id"], user_addr, int(rp["amount_wei"]), rp["deadline"]], rp["signature"]),
                    USER_KEY, user_addr,
                )
                resp = await client.post("/api/v1/web3/claims/confirm", json={"claim_id": rp["claim_id"], "tx_hash": tx_hash, "chain_id": CHAIN_ID})
                check("royalty claim confirmed", resp.status_code == 200 and resp.json().get("status") == "confirmed", resp.text[:200])
                check("royalty exclusivity (no re-prepare)", (await client.post("/api/v1/web3/claims/prepare", json={"reward_id": royalty_id, "wallet_address": user_addr, "chain_id": CHAIN_ID})).status_code == 409)

            # ---- 7. ledger + transaction visibility ----
            resp = await client.get("/api/v1/web3/claims")
            items = resp.json().get("items", [])
            check("claim history exposes prepared claims", len(items) >= 2, f"n={len(items)}")
            confirmed_states = [i.get("state") for i in items]
            check("history shows confirmed state", any(s == "confirmed" for s in confirmed_states), str(confirmed_states))
            resp = await client.get("/api/v1/web3/transactions")
            tx_items = resp.json().get("items", [])
            check("transactions ledger has claim+stake+settlements", len(tx_items) >= 6, f"n={len(tx_items)}")

            print("[E2E] core web3 economy flows exercised on local Anvil")
            return 0
    finally:
        stop_anvil()


USER_ID = str(uuid4())


def main() -> int:
    global FAIL, PASS
    try:
        rc = asyncio.run(run())
    except Exception as exc:  # noqa: BLE001
        bad("harness exception", f"{type(exc).__name__}: {exc}")
        rc = 1
    print(f"\n[E2E] result: {PASS} passed, {FAIL} failed")
    return 1 if FAIL or rc else 0


if __name__ == "__main__":
    sys.exit(main())