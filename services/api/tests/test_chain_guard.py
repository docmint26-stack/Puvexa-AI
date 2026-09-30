"""Phase 5: mainnet guard tests.

The product may only ever run against BNB Smart Chain Testnet (97) or a local dev chain.
A misconfigured `WEB3_CHAIN_ID` must never silently point it at a production network, and
there is no runtime flag that can turn mainnet back on.
"""
import pytest

from app.core.chain_guard import (
    MAINNET_CHAIN_IDS,
    SUPPORTED_TESTNET_CHAIN_IDS,
    assert_chain_allowed,
    is_mainnet,
    is_supported,
)
from app.core.exceptions import APIError


@pytest.mark.parametrize("chain_id", sorted(MAINNET_CHAIN_IDS))
def test_mainnet_ids_are_identified(chain_id):
    assert is_mainnet(chain_id)
    assert not is_supported(chain_id)


@pytest.mark.parametrize("chain_id", sorted(MAINNET_CHAIN_IDS))
def test_mainnet_is_always_refused(chain_id):
    with pytest.raises(APIError) as error:
        assert_chain_allowed(chain_id)
    assert error.value.status == 503
    assert error.value.code == "WEB3_MAINNET_DISABLED"


def test_bnb_testnet_is_allowed():
    assert SUPPORTED_TESTNET_CHAIN_IDS == frozenset({97})
    assert assert_chain_allowed(97) == 97


def test_local_development_chains_are_allowed():
    for chain_id in (31337, 13370, 13379):
        assert assert_chain_allowed(chain_id) == chain_id


def test_unknown_chain_is_refused():
    with pytest.raises(APIError) as error:
        assert_chain_allowed(4242)
    assert error.value.code == "WEB3_CHAIN_UNSUPPORTED"


def test_missing_chain_id_is_refused():
    with pytest.raises(APIError) as error:
        assert_chain_allowed(None)
    assert error.value.code == "WEB3_CHAIN_UNCONFIGURED"


def test_non_integer_chain_id_is_refused():
    with pytest.raises(APIError) as error:
        assert_chain_allowed("mainnet")
    assert error.value.code == "WEB3_CHAIN_UNCONFIGURED"
