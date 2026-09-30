"""Mainnet guard.

Puvexa may only ever run against a testnet (BNB Smart Chain Testnet, chain id 97) or a
local development chain. Any production/mainnet chain id is rejected at configuration
time, at request time, and by the readiness probe.

The deny-list intentionally mirrors the frontend guard in `src/lib/web3/config.ts` so
the two sides can never disagree about what counts as "production".
"""
from app.core.exceptions import APIError

#: Chain ids that are treated as production/mainnet networks. Never deploy here.
MAINNET_CHAIN_IDS: frozenset[int] = frozenset(
    {
        1,  # Ethereum mainnet
        56,  # BNB Smart Chain mainnet
        137,  # Polygon PoS
        42161,  # Arbitrum One
        10,  # OP Mainnet
        8453,  # Base
        43114,  # Avalanche C-Chain
        81457,  # Blast
        59144,  # Linea
        534352,  # Scroll
    }
)

#: The only public network this product is allowed to touch right now.
SUPPORTED_TESTNET_CHAIN_IDS: frozenset[int] = frozenset({97})


def is_mainnet(chain_id: int | None) -> bool:
    """True when the chain id belongs to a production network."""
    try:
        return int(chain_id) in MAINNET_CHAIN_IDS
    except (TypeError, ValueError):
        return False


def is_supported(chain_id: int | None) -> bool:
    """True for BNB Testnet or a local development chain."""
    try:
        value = int(chain_id)
    except (TypeError, ValueError):
        return False
    return value in SUPPORTED_TESTNET_CHAIN_IDS or value == 31337 or 13370 <= value <= 13379


def assert_chain_allowed(chain_id: int | None) -> int:
    """Validates a configured chain id.

    Mainnet ids are refused unconditionally — there is no runtime escape hatch, because
    this product is permanently testnet-only. Unknown non-testnet ids are refused too, so
    a typo in `WEB3_CHAIN_ID` cannot silently point the product at some other network.
    """
    if chain_id is None:
        raise APIError(503, "WEB3_CHAIN_UNCONFIGURED", "No chain id is configured.")
    try:
        value = int(chain_id)
    except (TypeError, ValueError) as exc:
        raise APIError(503, "WEB3_CHAIN_UNCONFIGURED", "Chain id is not a valid integer.") from exc

    if is_mainnet(value):
        raise APIError(
            503,
            "WEB3_MAINNET_DISABLED",
            f"Mainnet chain {value} is disabled in this environment.",
        )

    if not is_supported(value):
        raise APIError(
            503,
            "WEB3_CHAIN_UNSUPPORTED",
            f"Chain {value} is not a supported testnet. BNB Testnet (97) is required.",
        )
    return value
