"""Phase 5: web3 economy tests.

Covers:
- signer configuration gating (reject before config is present)
- EIP-712 payload shape + signature that recovers to the reward signer
- claim prepare requires a verified wallet and a claimable reward
- a prepare is one-shot per reward (duplicate reserved)
- chain confirmation requires an authoritative on-chain ClaimPaid event
- amount/recipient mismatches are rejected; DB claim stays unconfirmed
- replay confirmations are rejected
- stakes record a confirmed web3 transaction
- token config / status reflects live settings
"""
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from eth_account import Account
from eth_hash.auto import keccak
from hexbytes import HexBytes
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import ClaimReservation, RewardLedger, WalletLink, Web3Transaction
from app.db.session import Session
from app.services.web3_economy import (
    CLAIM_PAID_EVENT,
    DOMAIN_NAME,
    DOMAIN_VERSION,
    STAKED_EVENT,
    ChainVerifier,
    _wei,
)

TOKEN = "0x1111111111111111111111111111111111111111"
DISTRIBUTOR = "0x2222222222222222222222222222222222222222"
VAULT = "0x3333333333333333333333333333333333333333"
SIGNER_KEY = "0x1111111111111111111111111111111111111111111111111111111111111111"
WALLET = "0x00000000000000000000000000000000000000Ad"


def enable_web3(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "web3_claim_enabled", True)
    monkeypatch.setattr(settings, "web3_testnet_rpc_url", "https://mock-rpc.invalid")
    monkeypatch.setattr(settings, "web3_chain_id", 31337)
    monkeypatch.setattr(settings, "web3_token_address", TOKEN)
    monkeypatch.setattr(settings, "web3_distributor_address", DISTRIBUTOR)
    monkeypatch.setattr(settings, "web3_stake_vault_address", VAULT)
    monkeypatch.setattr(settings, "web3_reward_signer_private_key", SIGNER_KEY)
    monkeypatch.setattr(settings, "allow_mainnet_deployment", False)
    return settings


def claim_paid_log(claim_id, recipient, amount_wei, deadline):
    topic0 = ChainVerifier._topic0(CLAIM_PAID_EVENT)
    recipient_topic = "0x" + "0" * 24 + recipient[2:]
    return {
        "address": DISTRIBUTOR,
        "topics": [HexBytes(topic0), HexBytes(claim_id), HexBytes(recipient_topic)],
        "data": HexBytes(amount_wei.to_bytes(32, "big") + deadline.to_bytes(32, "big")),
    }


def staked_log(contribution_id, wallet, amount_wei):
    topic0 = ChainVerifier._topic0(STAKED_EVENT)
    wallet_topic = "0x" + "0" * 24 + wallet[2:]
    return {
        "address": VAULT,
        "topics": [HexBytes(topic0), HexBytes(contribution_id), HexBytes(wallet_topic)],
        "data": HexBytes(amount_wei.to_bytes(32, "big")),
    }


def released_log(contribution_id, wallet, amount_wei):
    from app.services.web3_economy import RELEASED_EVENT

    topic0 = ChainVerifier._topic0(RELEASED_EVENT)
    wallet_topic = "0x" + "0" * 24 + wallet[2:]
    return {
        "address": VAULT,
        "topics": [HexBytes(topic0), HexBytes(contribution_id), HexBytes(wallet_topic)],
        "data": HexBytes(amount_wei.to_bytes(32, "big")),
    }


def slashed_log(contribution_id, wallet, slashed_wei, returned_wei):
    from app.services.web3_economy import SLASHED_EVENT

    topic0 = ChainVerifier._topic0(SLASHED_EVENT)
    wallet_topic = "0x" + "0" * 24 + wallet[2:]
    return {
        "address": VAULT,
        "topics": [HexBytes(topic0), HexBytes(contribution_id), HexBytes(wallet_topic)],
        "data": HexBytes(slashed_wei.to_bytes(32, "big") + returned_wei.to_bytes(32, "big")),
    }


def receipt_with(logs, status=1, block=42):
    return {"status": status, "logs": logs, "blockNumber": block, "to": DISTRIBUTOR}


def patch_chain_receipt(monkeypatch, receipt_fn):
    """Routes the live Web3EconomyService.chain.get_receipt to a fake async fn."""
    async def fake_get_receipt(self, tx_hash):
        return receipt_fn(tx_hash)

    monkeypatch.setattr(ChainVerifier, "get_receipt", fake_get_receipt)


async def grant_claimable_reward(api, alice, monkeypatch, amount="8"):
    """Runs the standard scenario and accepts the outcome to mint a claimable reward."""
    enable_web3(monkeypatch)
    scenario = await api.make_scenario()
    from app.services.workflows import accept_outcome

    async with Session() as db:
        await accept_outcome(db, scenario["outcome"]["id"])
        await db.commit()
    return scenario


async def link_verified_wallet(user_id, address=WALLET, status="verified"):
    from app.services.wallet import normalize_address

    addr = normalize_address(address)
    async with Session() as db:
        link = WalletLink(user_id=user_id, wallet_address=addr, status=status, chain_id=31337, verified_at=datetime.now(UTC))
        db.add(link)
        await db.commit()
        return link.id


async def ensure_profile(api, alice):
    api.set_identity(alice)
    resp = await api.client.get("/api/v1/profile")
    assert resp.status_code == 200, resp.text
    return resp


async def prepare_claim(api, alice, monkeypatch):
    scenario = await grant_claimable_reward(api, alice, monkeypatch)
    async with Session() as db:
        reward = (await db.scalars(select(RewardLedger))).all()[0]
        reward_id = str(reward.id)
    await link_verified_wallet(alice.id)
    resp = await api.client.post(
        "/api/v1/web3/claims/prepare",
        json={"reward_id": reward_id, "wallet_address": WALLET, "chain_id": 31337},
    )
    return scenario, reward_id, resp


@pytest.fixture(autouse=True)
def _clean(clean_db):
    yield


async def test_web3_status_requires_enabled_config(api, alice):
    api.set_identity(alice)
    resp = await api.client.get("/api/v1/web3/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["chain_id"] == get_settings().web3_chain_id
    assert body["claim_enabled"] is False
    assert body["rpc_configured"] is False


async def test_web3_status_reflects_config(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    resp = await api.client.get("/api/v1/web3/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["claim_enabled"] is True
    assert body["rpc_configured"] is True
    assert body["signer_address"].startswith("0x")


async def test_claim_prepare_rejected_when_disabled(api, alice):
    await ensure_profile(api, alice)
    await link_verified_wallet(alice.id)
    await api.make_scenario()
    resp = await api.client.post(
        "/api/v1/web3/claims/prepare",
        json={"reward_id": "00000000-0000-0000-0000-000000000001", "wallet_address": WALLET},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "WEB3_UNAVAILABLE"


async def test_claim_prepare_requires_verified_wallet(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    scenario = await api.make_scenario()
    from app.services.workflows import accept_outcome

    async with Session() as db:
        await accept_outcome(db, scenario["outcome"]["id"])
        await db.commit()
        reward = (await db.scalars(select(RewardLedger))).all()[0]
        reward_id = str(reward.id)
    resp = await api.client.post(
        "/api/v1/web3/claims/prepare",
        json={"reward_id": reward_id, "wallet_address": WALLET, "chain_id": 31337},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "WALLET_NOT_VERIFIED"


async def test_claim_prepare_rejects_unverified_link(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    scenario = await api.make_scenario()
    from app.services.workflows import accept_outcome

    async with Session() as db:
        await accept_outcome(db, scenario["outcome"]["id"])
        await db.commit()
        reward = (await db.scalars(select(RewardLedger))).all()[0]
        reward_id = str(reward.id)
    await link_verified_wallet(alice.id, status="pending")
    resp = await api.client.post(
        "/api/v1/web3/claims/prepare",
        json={"reward_id": reward_id, "wallet_address": WALLET, "chain_id": 31337},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "WALLET_NOT_VERIFIED"


async def test_claim_prepare_signs_eip712_for_authoritative_amount(api, alice, monkeypatch):
    api.set_identity(alice)
    _, _, resp = await prepare_claim(api, alice, monkeypatch)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["claim_id"].startswith("0x")
    assert len(body["claim_id"]) == 66
    assert body["recipient"] == WALLET.lower()
    assert body["chain_id"] == 31337
    assert body["verifying_contract"] == DISTRIBUTOR

    assert Decimal(body["amount_fixai"]) == Decimal("8")
    assert int(body["amount_wei"]) == 8 * 10**18
    assert body["signature"].startswith("0x")
    assert len(body["signature"]) == 132

    typed = body["eip712"]
    assert typed["primaryType"] == "Claim"
    assert typed["domain"]["name"] == DOMAIN_NAME
    assert typed["domain"]["version"] == DOMAIN_VERSION
    # The digest must equal Solidity's _hashTypedDataV4(
    #   keccak(CLAIM_TYPEHASH || claimId || recipient || amount || deadline))
    # recompute independently:
    claim_typehash = keccak(b"Claim(bytes32 claimId,address recipient,uint256 amount,uint256 deadline)")
    domain_typehash = keccak(b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    domain_sep = keccak(
        domain_typehash
        + keccak(DOMAIN_NAME.encode())
        + keccak(DOMAIN_VERSION.encode())
        + (31337).to_bytes(32, "big")
        + bytes.fromhex("0" * 24 + DISTRIBUTOR[2:])
    )
    struct_hash = keccak(
        claim_typehash
        + bytes.fromhex(body["claim_id"][2:])
        + bytes.fromhex("0" * 24 + WALLET[2:])
        + int(body["amount_wei"]).to_bytes(32, "big")
        + body["deadline"].to_bytes(32, "big")
    )
    expected_digest = keccak(b"\x19\x01" + domain_sep + struct_hash)
    assert body["digest"] == expected_digest.hex()

    recovered = Account._recover_hash(expected_digest, signature=body["signature"])
    assert _signer_pathok(recovered)


def _signer_pathok(recovered):
    return (
        Account.from_key(get_settings().web3_reward_signer_private_key).address.lower()
        == recovered.lower()
    )


async def test_claim_prepare_is_one_shot_per_reward(api, alice, monkeypatch):
    api.set_identity(alice)
    _, _, resp = await prepare_claim(api, alice, monkeypatch)
    assert resp.status_code == 201, resp.text
    second = await api.client.post(
        "/api/v1/web3/claims/prepare",
        json={"reward_id": resp.json()["reward_id"], "wallet_address": WALLET, "chain_id": 31337},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] in ("REWARD_ALREADY_RESERVED", "REWARD_NOT_CLAIMABLE")


async def test_claim_confirm_settles_when_chain_pays(api, alice, monkeypatch):
    api.set_identity(alice)
    _, _, prepared = await prepare_claim(api, alice, monkeypatch)
    claim_id = prepared.json()["claim_id"]
    amount_wei = int(prepared.json()["amount_wei"])

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with([claim_paid_log(claim_id, WALLET, amount_wei, prepared.json()["deadline"])]),
    )

    tx = "0x" + "aa" * 32
    resp = await api.client.post(
        "/api/v1/web3/claims/confirm",
        json={"claim_id": claim_id, "tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "confirmed"
    assert body["tx_hash"] == tx

    async with Session() as db:
        claim = await db.scalar(select(ClaimReservation).where(ClaimReservation.claim_id == claim_id))
        assert claim.state == "confirmed"
        txs = (await db.scalars(select(Web3Transaction).where(Web3Transaction.user_id == alice.id))).all()
        assert len(txs) == 1
        assert txs[0].tx_hash == tx
        assert txs[0].status == "confirmed"


async def test_claim_confirm_rejects_wrong_amount(api, alice, monkeypatch):
    api.set_identity(alice)
    _, _, prepared = await prepare_claim(api, alice, monkeypatch)
    claim_id = prepared.json()["claim_id"]
    wrong_amount = 10 * 10**18

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with(
            [claim_paid_log(claim_id, WALLET, wrong_amount, prepared.json()["deadline"])]
        ),
    )

    tx = "0x" + "bb" * 32
    resp = await api.client.post(
        "/api/v1/web3/claims/confirm",
        json={"claim_id": claim_id, "tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEB3_AMOUNT_MISMATCH"

    async with Session() as db:
        claim = await db.scalar(select(ClaimReservation).where(ClaimReservation.claim_id == claim_id))
        assert claim.state != "confirmed"


async def test_claim_confirm_rejects_wrong_recipient(api, alice, monkeypatch):
    api.set_identity(alice)
    _, _, prepared = await prepare_claim(api, alice, monkeypatch)
    claim_id = prepared.json()["claim_id"]
    other = "0x00000000000000000000000000000000000000Be"

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with(
            [claim_paid_log(claim_id, other, int(prepared.json()["amount_wei"]), prepared.json()["deadline"])]
        ),
    )

    tx = "0x" + "cc" * 32
    resp = await api.client.post(
        "/api/v1/web3/claims/confirm",
        json={"claim_id": claim_id, "tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEB3_RECIPIENT_MISMATCH"


async def test_claim_confirm_rejects_reverted_tx(api, alice, monkeypatch):
    api.set_identity(alice)
    _, _, prepared = await prepare_claim(api, alice, monkeypatch)
    claim_id = prepared.json()["claim_id"]

    patch_chain_receipt(monkeypatch, lambda tx_hash: receipt_with([], status=0))

    tx = "0x" + "dd" * 32
    resp = await api.client.post(
        "/api/v1/web3/claims/confirm",
        json={"claim_id": claim_id, "tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEB3_TX_FAILED"


async def test_claim_confirm_replays_rejected(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    scenario = await api.make_scenario()
    from app.services.workflows import accept_outcome

    async with Session() as db:
        await accept_outcome(db, scenario["outcome"]["id"])
        await db.commit()
        reward = (await db.scalars(select(RewardLedger))).all()[0]
        reward_id = str(reward.id)
    await link_verified_wallet(alice.id)
    prepared = await api.client.post(
        "/api/v1/web3/claims/prepare",
        json={"reward_id": reward_id, "wallet_address": WALLET, "chain_id": 31337},
    )
    claim_id = prepared.json()["claim_id"]
    amount_wei = int(prepared.json()["amount_wei"])

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with(
            [claim_paid_log(claim_id, WALLET, amount_wei, prepared.json()["deadline"])]
        ),
    )

    tx = "0x" + "ee" * 32
    first = await api.client.post(
        "/api/v1/web3/claims/confirm",
        json={"claim_id": claim_id, "tx_hash": tx, "chain_id": 31337},
    )
    assert first.status_code == 200, first.text
    second = await api.client.post(
        "/api/v1/web3/claims/confirm",
        json={"claim_id": claim_id, "tx_hash": "0x" + "ff" * 32, "chain_id": 31337},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CLAIM_ALREADY_CONFIRMED"


async def test_claim_list_only_exposes_prepared_claims(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    resp = await api.client.get("/api/v1/web3/claims")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_stake_confirm_records_transaction(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    await ensure_profile(api, alice)
    await link_verified_wallet(alice.id)
    contribution_id = "0x" + "12" * 32
    stake_amount = 5 * 10**18

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with(
            [staked_log(contribution_id, WALLET, stake_amount)], block=99
        ),
    )

    tx = "0x" + "ab" * 32
    resp = await api.client.post(
        "/api/v1/web3/stakes/confirm",
        json={"contribution_id": contribution_id, "wallet_address": WALLET, "tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "confirmed"
    assert resp.json()["amount_wei"] == str(stake_amount)

    async with Session() as db:
        txs = (await db.scalars(select(Web3Transaction).where(Web3Transaction.tx_type == "stake"))).all()
        assert len(txs) == 1
        assert txs[0].tx_hash == tx
        assert txs[0].to_address == VAULT


async def test_web3_token_config(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    resp = await api.client.get("/api/v1/web3/token")
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_address"] == TOKEN
    assert body["distributor_address"] == DISTRIBUTOR
    assert body["stake_vault_address"] == VAULT
    assert body["chain_id"] == 31337


def test_wei_conversion_and_guards():
    assert _wei("12") == 12 * 10**18
    assert _wei("0") == 0
    assert _wei("0.5") == 5 * 10**17
    from app.core.exceptions import APIError

    with pytest.raises(APIError):
        _wei("abc")
    with pytest.raises(APIError):
        _wei("-1")


async def test_stake_release_records_transaction(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    await ensure_profile(api, alice)
    contribution_id = "0x" + "12" * 32
    amount_wei = 5 * 10**18

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with(
            [released_log(contribution_id, WALLET, amount_wei)], block=144
        ),
    )

    tx = "0x" + "ac" * 32
    resp = await api.client.post(
        f"/api/v1/web3/stakes/{contribution_id}/release",
        json={"tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "confirmed"
    assert body["wallet_address"] == WALLET.lower()
    assert body["returned_wei"] == str(amount_wei)
    assert body["slashed_wei"] == str(0)

    async with Session() as db:
        txs = (await db.scalars(select(Web3Transaction).where(Web3Transaction.tx_type == "stake_release"))).all()
        assert len(txs) == 1
        assert txs[0].tx_hash == tx
        assert txs[0].from_address == VAULT
        assert txs[0].to_address == WALLET.lower()


async def test_stake_slash_records_transaction(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    await ensure_profile(api, alice)
    contribution_id = "0x" + "12" * 32
    slashed_wei = 3 * 10**18
    returned_wei = 2 * 10**18

    patch_chain_receipt(
        monkeypatch,
        lambda tx_hash: receipt_with(
            [slashed_log(contribution_id, WALLET, slashed_wei, returned_wei)], block=200
        ),
    )

    tx = "0x" + "ad" * 32
    resp = await api.client.post(
        f"/api/v1/web3/stakes/{contribution_id}/slash",
        json={"tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "confirmed"
    assert body["slashed_wei"] == str(slashed_wei)
    assert body["returned_wei"] == str(returned_wei)

    async with Session() as db:
        txs = (await db.scalars(select(Web3Transaction).where(Web3Transaction.tx_type == "stake_slash"))).all()
        assert len(txs) == 1
        assert txs[0].tx_hash == tx
        assert txs[0].from_address == VAULT


async def test_stake_settlement_rejects_reverted_tx(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    await ensure_profile(api, alice)
    contribution_id = "0x" + "12" * 32

    patch_chain_receipt(monkeypatch, lambda tx_hash: receipt_with([], status=0))

    tx = "0x" + "ae" * 32
    resp = await api.client.post(
        f"/api/v1/web3/stakes/{contribution_id}/release",
        json={"tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEB3_TX_FAILED"

    resp = await api.client.post(
        f"/api/v1/web3/stakes/{contribution_id}/slash",
        json={"tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEB3_TX_FAILED"


async def test_stake_settlement_rejects_missing_event(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    await ensure_profile(api, alice)
    contribution_id = "0x" + "12" * 32

    patch_chain_receipt(monkeypatch, lambda tx_hash: receipt_with([], status=1))

    tx = "0x" + "af" * 32
    resp = await api.client.post(
        f"/api/v1/web3/stakes/{contribution_id}/slash",
        json={"tx_hash": tx, "chain_id": 31337},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEB3_SLASH_EVENT_MISSING"


async def test_stake_settlement_rejects_invalid_kind(api, alice, monkeypatch):
    api.set_identity(alice)
    enable_web3(monkeypatch)
    await ensure_profile(api, alice)
    contribution_id = "0x" + "12" * 32
    from app.core.exceptions import APIError
    from app.db.session import Session as _Session
    from app.services.web3_economy import Web3EconomyService

    async with _Session() as db:
        svc = Web3EconomyService(db)
        with pytest.raises(APIError):
            await svc.confirm_stake_settlement(
                contribution_id=contribution_id, user_id=alice.id, tx_hash="0x" + "aa" * 32, kind="mint"
            )


async def test_eip191_verifier_recovers_signer_and_rejects_forgeries():
    from eth_account.messages import encode_defunct

    from app.services.wallet import EIP191SignatureVerifier

    account = Account.create()
    address = account.address
    message = f"Puvexa wallet verification\nchain-id:31337\naddress:{address.lower()}\nnonce:challenge123"
    signature = "0x" + Account.sign_message(encode_defunct(text=message), account.key).signature.hex()

    verifier = EIP191SignatureVerifier()
    assert await verifier.verify_signed_message(address, message, signature) is True
    assert await verifier.verify_signed_message(address, message + "-tampered", signature) is False
    assert await verifier.verify_signed_message(address, message, "0x" + "00" * 65) is False