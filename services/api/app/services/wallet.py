"""Wallet verification with one-time, expiring challenge nonces.

Security model:
- Server issues a short-lived nonce bound to the user's wallet address (chain_id included).
- The client signs a fixed message containing the nonce; ownership is proven by signature.
- Nonces are single-use: any reuse after consumption is treated as replay and rejected.
- Expired nonces are invalidated server-side; a fresh challenge is required.
- Addresses are normalized (lowercase hex) to prevent case-based identity splitting.
- Signature verification is delegated to a pluggable provider; nothing is faked here.
"""
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.base import now
from app.db.models import WalletLink
from app.services.workflows import audit


def normalize_address(address: str) -> str:
    """Normalizes a wallet address to a canonical form for identity comparison."""
    cleaned = (address or "").strip()
    if not cleaned:
        raise APIError(422, "INVALID_WALLET_ADDRESS", "Provide a wallet address.")
    if cleaned.startswith("0x") or cleaned.startswith("0X"):
        return "0x" + cleaned[2:].lower()
    return cleaned


def build_signing_message(address: str, nonce: str, chain_id: int | None) -> str:
    """Builds the exact signed message the client must sign to prove wallet ownership."""
    chain = f"chain-id:{chain_id}" if chain_id else "chain-id:any"
    return f"Puvexa wallet verification\n{chain}\naddress:{normalize_address(address)}\nnonce:{nonce}"


class SignatureVerifier:
    """Pluggable signature verification boundary.

    A concrete implementation verifies an EIP-191 / EIP-712 signature against the
    signing message. Until a provider is wired, verification is refused — signatures
    are never accepted without cryptographic confirmation.
    """

    async def verify_signed_message(self, address: str, message: str, signature: str) -> bool:
        raise APIError(503, "WALLET_SIGNATURE_UNAVAILABLE", "Wallet signature verification is not configured yet.")


class EIP191SignatureVerifier(SignatureVerifier):
    """EIP-191 (personal_sign) recovery against the claimed wallet address.

    This is the canonical boundary for the challenge messages the backend issues:
    the client signs the exact `message` string and we recover the signer. Recovery
    is performed independently with eth_account; no client claim is trusted.
    """

    async def verify_signed_message(self, address: str, message: str, signature: str) -> bool:
        from eth_account import Account
        from eth_account.messages import encode_defunct

        signable = encode_defunct(text=message)
        try:
            recovered = Account.recover_message(signable, signature=signature)
        except Exception:  # noqa: BLE001
            return False
        return normalize_address(recovered) == normalize_address(address)


class WalletVerificationService:
    def __init__(self, db: AsyncSession, verifier: SignatureVerifier | None = None):
        self.db = db
        self.verifier = verifier or SignatureVerifier()

    async def get_or_create_link(self, user_id: str, address: str, chain_id: int | None = None) -> WalletLink:
        addr = normalize_address(address)
        link = await self.db.scalar(select(WalletLink).where(WalletLink.wallet_address == addr))
        if not link:
            link = WalletLink(user_id=user_id, wallet_address=addr, chain_id=chain_id)
            self.db.add(link)
            await self.db.flush()
            audit(self.db, user_id, "wallet_link_created", "wallet", link.id)
            return link
        if link.user_id != user_id:
            raise APIError(409, "WALLET_LINKED_ELSEWHERE", "This wallet is already linked to another account.")
        return link

    async def create_challenge(self, user_id: str, address: str, chain_id: int | None = None) -> dict:
        """Issues a fresh one-time nonce for signature challenge."""
        link = await self.get_or_create_link(user_id, address, chain_id)
        ttl = timedelta(minutes=get_settings().wallet_nonce_ttl_minutes)
        link.nonce = secrets.token_urlsafe(32)
        link.nonce_expires_at = now() + ttl
        link.nonce_used_at = None
        await self.db.flush()
        audit(self.db, user_id, "wallet_challenge_issued", "wallet", link.id)
        return {
            "nonce": link.nonce,
            "expires_at": link.nonce_expires_at,
            "message": build_signing_message(address, link.nonce, chain_id),
            "ttl_minutes": get_settings().wallet_nonce_ttl_minutes,
        }

    async def verify(self, user_id: str, address: str, signature: str, chain_id: int | None = None, nonce: str | None = None) -> dict:
        """Consumes the one-time nonce after a valid signature confirms wallet ownership."""
        addr = normalize_address(address)
        link = await self.db.scalar(select(WalletLink).where(WalletLink.wallet_address == addr))
        if not link or link.user_id != user_id:
            raise APIError(404, "WALLET_NOT_FOUND", "No wallet challenge exists for this address.")

        if nonce and link.nonce != nonce:
            raise APIError(409, "WALLET_NONCE_REPLAY", "Challenge nonce mismatch; request a fresh challenge.")
        if link.nonce_used_at is not None:
            raise APIError(409, "WALLET_NONCE_REPLAY", "This challenge nonce has already been used. Request a fresh challenge.")
        if link.nonce is None or link.nonce_expires_at is None:
            raise APIError(422, "WALLET_NO_CHALLENGE", "Request a challenge before verifying.")

        if link.nonce_expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
            raise APIError(410, "WALLET_NONCE_EXPIRED", "This challenge has expired. Request a fresh challenge.")

        message = build_signing_message(addr, link.nonce, chain_id or link.chain_id)
        valid = await self.verifier.verify_signed_message(addr, message, signature)
        if not valid:
            raise APIError(401, "WALLET_SIGNATURE_INVALID", "Signature did not verify wallet ownership.")

        link.nonce_used_at = now()
        link.status = "verified"
        link.verified_at = now()
        await self.db.flush()
        audit(self.db, user_id, "wallet_link_verified", "wallet", link.id)
        return {"status": "verified", "wallet_address": addr, "verified_at": link.verified_at}

    async def revoke(self, user_id: str, address: str) -> bool:
        addr = normalize_address(address)
        link = await self.db.scalar(select(WalletLink).where(WalletLink.wallet_address == addr))
        if not link or link.user_id != user_id:
            raise APIError(404, "WALLET_NOT_FOUND", "Wallet is not linked to this account.")
        link.status = "revoked"
        link.nonce = None
        link.nonce_expires_at = None
        link.nonce_used_at = None
        await self.db.flush()
        audit(self.db, user_id, "wallet_link_revoked", "wallet", link.id)
        return True