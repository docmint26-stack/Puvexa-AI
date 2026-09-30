r"""BNB Testnet (chain 97) readiness probe.

Unlike a config-only check, this probe performs REAL chain reads:

  * RPC reachable and `eth_chainId == 97`
  * every contract address non-zero with deployed bytecode present
  * token  : name / symbol / decimals / total supply / treasury balance / no mint / no burn
  * RewardDistributor : token / authorized signer / owner / paused / balance
  * ContributionStakeVault : token / slashVault / slashBps / admin role / operator role
  * ContributionRegistry : admin role / anchor role
  * backend : WEB3_CLAIM_ENABLED, EIP-191 verifier, signer configured, mainnet guard

`BNB_TESTNET_PROBE=PASS` is printed only when every chain and backend check passes.
No key material is ever printed or written.

Run from services/api with the venv:
  .\\.venv\\Scripts\\python.exe scripts\\bnb_testnet_probe.py
Exit 0 = PASS, 1 = BLOCKED (with the exact blockers listed).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from web3 import HTTPProvider, Web3  # noqa: E402

from app.core.chain_guard import assert_chain_allowed, is_mainnet  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.exceptions import APIError  # noqa: E402

API_DIR = Path(__file__).resolve().parents[1]
ROOT = API_DIR.parent.parent
ARTIFACT_CANDIDATES = [
    ROOT / "contracts" / "deployments" / "bnb-testnet.json",
    ROOT / "contracts" / "deployments" / "local.json",
]

EXPECTED_SUPPLY = 1_000_000_000 * 10**18
MIN_DISTRIBUTOR_FUNDING = 10_000 * 10**18
MAX_DISTRIBUTOR_FUNDING = 100_000 * 10**18

MINT_SELECTOR = "40c10f19"  # mint(address,uint256)
BURN_SELECTOR = "42966c68"  # burn(uint256)

ERC20_ABI = [
    {"name": "name", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "string"}]},
    {"name": "symbol", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "string"}]},
    {"name": "decimals", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint8"}]},
    {"name": "totalSupply", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "balanceOf", "type": "function", "stateMutability": "view", "inputs": [{"name": "account", "type": "address"}], "outputs": [{"name": "", "type": "uint256"}]},
]

DISTRIBUTOR_ABI = [
    {"name": "token", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]},
    {"name": "authorizedSigner", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]},
    {"name": "owner", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]},
    {"name": "paused", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "bool"}]},
]

VAULT_ABI = [
    {"name": "token", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]},
    {"name": "slashVault", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]},
    {"name": "slashBps", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "DEFAULT_ADMIN_ROLE", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "bytes32"}]},
    {"name": "OPERATOR_ROLE", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "bytes32"}]},
    {"name": "hasRole", "type": "function", "stateMutability": "view", "inputs": [{"name": "role", "type": "bytes32"}, {"name": "account", "type": "address"}], "outputs": [{"name": "", "type": "bool"}]},
]

REGISTRY_ABI = [
    {"name": "DEFAULT_ADMIN_ROLE", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "bytes32"}]},
    {"name": "ANCHOR_ROLE", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "bytes32"}]},
    {"name": "hasRole", "type": "function", "stateMutability": "view", "inputs": [{"name": "role", "type": "bytes32"}, {"name": "account", "type": "address"}], "outputs": [{"name": "", "type": "bool"}]},
]


def _zero(value: str) -> bool:
    return not value or int(value, 16) == 0


def load_artifact() -> dict:
    for path in ARTIFACT_CANDIDATES:
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                continue
    return {}


def main() -> int:
    s = get_settings()
    blocked: list[str] = []
    notes: list[str] = []
    artifact = load_artifact()

    print(f"BNB readiness probe (chain {s.web3_chain_id})")

    # ---------------------------------------------------------------- backend
    if not s.web3_claim_enabled:
        blocked.append("web3_claim_enabled is false (claims/stakes offline by design)")
    if s.wallet_signature_verifier != "eip191":
        blocked.append(f"wallet_signature_verifier='{s.wallet_signature_verifier or 'none'}' (must be 'eip191')")
    if not s.web3_reward_signer_private_key:
        blocked.append("web3_reward_signer_private_key (EIP-712 claim signer) is empty")
    if s.allow_mainnet_deployment:
        blocked.append("allow_mainnet_deployment must remain False (MAINNET disabled)")
    try:
        assert_chain_allowed(s.web3_chain_id)
    except APIError as exc:
        blocked.append(f"{exc.code}: {exc.message}")

    if not s.web3_testnet_rpc_url:
        blocked.append("web3_testnet_rpc_url (BNB Testnet RPC) is empty")
        print("\nBNB_TESTNET_PROBE=BLOCKED")
        for item in blocked:
            print(f"  BLOCKED: {item}")
        return 1

    # ------------------------------------------------------------------- RPC
    w3 = Web3(HTTPProvider(s.web3_testnet_rpc_url, request_kwargs={"timeout": 15}))
    try:
        connected = w3.is_connected()
    except Exception:  # noqa: BLE001
        connected = False
    if not connected:
        blocked.append("web3_testnet_rpc_url unreachable")
        print("\nBNB_TESTNET_PROBE=BLOCKED")
        for item in blocked:
            print(f"  BLOCKED: {item}")
        return 1

    chain_id = int(w3.eth.chain_id)
    block = int(w3.eth.block_number)
    print(f"  RPC reachable: yes (chain {chain_id}, block {block})")
    if chain_id != 97:
        blocked.append(f"RPC answered chain {chain_id}, expected 97 (BNB Testnet)")
    if is_mainnet(chain_id):
        blocked.append(f"RPC answered a MAINNET chain id ({chain_id})")

    # ------------------------------------------------------------- contracts
    addresses = {
        "token": s.web3_token_address,
        "distributor": s.web3_distributor_address,
        "stakeVault": s.web3_stake_vault_address,
        "registry": s.web3_registry_address,
    }
    for name, value in addresses.items():
        if not value:
            blocked.append(f"web3_{name if name != 'stakeVault' else 'stake_vault'}_address is empty")
        elif not value.startswith("0x") or len(value) != 42:
            blocked.append(f"{name} address '{value}' is not a 20-byte 0x address")
        elif _zero(value):
            blocked.append(f"{name} address is the zero address")
        else:
            code = w3.eth.get_code(Web3.to_checksum_address(value))
            if not code or len(code) < 20:
                blocked.append(f"{name}: no deployed bytecode at {value}")
            else:
                print(f"  {name}: bytecode present at {value} ({len(code)} bytes)")

    if blocked:
        print("\nBNB_TESTNET_PROBE=BLOCKED")
        for item in blocked:
            print(f"  BLOCKED: {item}")
        return 1

    token = w3.eth.contract(address=Web3.to_checksum_address(s.web3_token_address), abi=ERC20_ABI)
    distributor = w3.eth.contract(address=Web3.to_checksum_address(s.web3_distributor_address), abi=DISTRIBUTOR_ABI)
    vault = w3.eth.contract(address=Web3.to_checksum_address(s.web3_stake_vault_address), abi=VAULT_ABI)
    registry = w3.eth.contract(address=Web3.to_checksum_address(s.web3_registry_address), abi=REGISTRY_ABI)

    # ------------------------------------------------------------------ token
    try:
        name = token.functions.name().call()
        symbol = token.functions.symbol().call()
        decimals = int(token.functions.decimals().call())
        supply = int(token.functions.totalSupply().call())
        print(f"  token: {name} / {symbol} / {decimals}dp / supply {supply}")
        if name != "Puvexa FIXAI":
            blocked.append(f"token name is '{name}', expected 'Puvexa FIXAI'")
        if symbol != "FIXAI":
            blocked.append(f"token symbol is '{symbol}', expected 'FIXAI'")
        if decimals != 18:
            blocked.append(f"token decimals is {decimals}, expected 18")
        if supply != EXPECTED_SUPPLY:
            blocked.append(f"total supply is {supply}, expected {EXPECTED_SUPPLY} (1,000,000,000 FIXAI)")
    except Exception as exc:  # noqa: BLE001
        blocked.append(f"token read failed ({type(exc).__name__})")

    try:
        runtime = bytes(w3.eth.get_code(Web3.to_checksum_address(s.web3_token_address))).hex()
        if MINT_SELECTOR in runtime:
            blocked.append("token bytecode exposes mint(address,uint256) — supply is not fixed")
        else:
            print("  token: no mint function in deployed bytecode")
        if BURN_SELECTOR in runtime:
            notes.append("token bytecode exposes burn(uint256)")
        else:
            print("  token: no burn function in deployed bytecode")
    except Exception as exc:  # noqa: BLE001
        blocked.append(f"token bytecode scan failed ({type(exc).__name__})")

    treasury = artifact.get("treasury")
    if treasury:
        try:
            treasury_balance = int(token.functions.balanceOf(Web3.to_checksum_address(treasury)).call())
            print(f"  treasury {treasury}: {treasury_balance}")
            if treasury_balance > EXPECTED_SUPPLY:
                blocked.append("treasury balance exceeds the fixed supply — unexpected mint")
        except Exception as exc:  # noqa: BLE001
            blocked.append(f"treasury balance read failed ({type(exc).__name__})")
    else:
        notes.append("deployment artifact has no treasury — treasury balance not checked")

    # ----------------------------------------------------------- distributor
    try:
        dist_token = distributor.functions.token().call()
        signer = distributor.functions.authorizedSigner().call()
        owner = distributor.functions.owner().call()
        paused = distributor.functions.paused().call()
        dist_balance = int(token.functions.balanceOf(Web3.to_checksum_address(s.web3_distributor_address)).call())
        print(f"  distributor: token={dist_token} signer={signer} owner={owner} paused={paused}")
        print(f"  distributor balance: {dist_balance} wei")
        if Web3.to_checksum_address(dist_token) != Web3.to_checksum_address(s.web3_token_address):
            blocked.append("RewardDistributor.token does not match WEB3_TOKEN_ADDRESS")
        if _zero(signer):
            blocked.append("RewardDistributor.authorizedSigner is the zero address")
        elif artifact.get("rewardSigner") and Web3.to_checksum_address(signer) != Web3.to_checksum_address(artifact["rewardSigner"]):
            blocked.append("RewardDistributor.authorizedSigner does not match the deployed reward signer")
        if _zero(owner):
            blocked.append("RewardDistributor.owner is the zero address")
        if paused:
            blocked.append("RewardDistributor is paused — claims would revert")
        if not (MIN_DISTRIBUTOR_FUNDING <= dist_balance <= MAX_DISTRIBUTOR_FUNDING):
            blocked.append(
                f"distributor holds {dist_balance} wei; expected between "
                f"{MIN_DISTRIBUTOR_FUNDING} and {MAX_DISTRIBUTOR_FUNDING} (10k-100k FIXAI)"
            )
    except Exception as exc:  # noqa: BLE001
        blocked.append(f"RewardDistributor read failed ({type(exc).__name__})")

    # ------------------------------------------------------------ stake vault
    try:
        vault_token = vault.functions.token().call()
        slash_vault = vault.functions.slashVault().call()
        slash_bps = int(vault.functions.slashBps().call())
        print(f"  stakeVault: token={vault_token} slashVault={slash_vault} slashBps={slash_bps}")
        if Web3.to_checksum_address(vault_token) != Web3.to_checksum_address(s.web3_token_address):
            blocked.append("ContributionStakeVault.token does not match WEB3_TOKEN_ADDRESS")
        if _zero(slash_vault):
            blocked.append("ContributionStakeVault.slashVault is the zero address")
        if not (0 < slash_bps <= 10000):
            blocked.append(f"slashBps {slash_bps} is outside (0, 10000]")
    except Exception as exc:  # noqa: BLE001
        blocked.append(f"ContributionStakeVault read failed ({type(exc).__name__})")

    operator = s.web3_operator_address or artifact.get("admin")
    if operator:
        try:
            admin_role = vault.functions.DEFAULT_ADMIN_ROLE().call()
            operator_role = vault.functions.OPERATOR_ROLE().call()
            has_admin = bool(vault.functions.hasRole(admin_role, Web3.to_checksum_address(artifact.get("admin") or operator)).call())
            has_operator = bool(vault.functions.hasRole(operator_role, Web3.to_checksum_address(operator)).call())
            print(f"  stakeVault roles: admin={has_admin} operator({operator})={has_operator}")
            if not has_admin:
                blocked.append("configured admin does not hold DEFAULT_ADMIN_ROLE on the stake vault")
            if not has_operator:
                blocked.append(f"{operator} does not hold OPERATOR_ROLE on the stake vault")
        except Exception as exc:  # noqa: BLE001
            blocked.append(f"stakeVault role check failed ({type(exc).__name__})")
    else:
        blocked.append("no operator/admin address configured (WEB3_OPERATOR_ADDRESS or deployment artifact)")

    # -------------------------------------------------------------- registry
    anchor = artifact.get("registryAnchor") or artifact.get("admin")
    admin = artifact.get("admin")
    if anchor and admin:
        try:
            reg_admin_role = registry.functions.DEFAULT_ADMIN_ROLE().call()
            anchor_role = registry.functions.ANCHOR_ROLE().call()
            has_admin = bool(registry.functions.hasRole(reg_admin_role, Web3.to_checksum_address(admin)).call())
            has_anchor = bool(registry.functions.hasRole(anchor_role, Web3.to_checksum_address(anchor)).call())
            print(f"  registry roles: admin={has_admin} anchor({anchor})={has_anchor}")
            if not has_admin:
                blocked.append("configured admin does not hold DEFAULT_ADMIN_ROLE on the registry")
            if not has_anchor:
                blocked.append(f"{anchor} does not hold ANCHOR_ROLE on the registry")
        except Exception as exc:  # noqa: BLE001
            blocked.append(f"registry role check failed ({type(exc).__name__})")
    else:
        blocked.append("deployment artifact has no admin/registryAnchor — registry roles cannot be verified")

    print()
    for note in notes:
        print(f"  NOTE: {note}")
    if blocked:
        print("BNB_TESTNET_PROBE=BLOCKED")
        for item in blocked:
            print(f"  BLOCKED: {item}")
        return 1
    print("BNB_TESTNET_PROBE=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
