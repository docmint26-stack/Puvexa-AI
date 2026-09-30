// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PuvexaFIXAI} from "../src/PuvexaFIXAI.sol";
import {ContributionRegistry} from "../src/ContributionRegistry.sol";
import {ContributionStakeVault} from "../src/ContributionStakeVault.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";

/// @title Puvexa deployment script (local Anvil + BNB Testnet chain 97)
/// @notice Deploys the full Puvexa token economy onto a live (Anvil/testnet) chain and funds the
///         RewardDistributor so claims can be settled. Writes the deployment artifact with the
///         resolved addresses/roles so the backend/frontend `.env` can be populated consistently.
///
/// Local playbook (chain id 31337):
///   forge script script/Deploy.s.sol \
///     --rpc-url http://127.0.0.1:8545 \
///     --private-key <anvil-key-1> --broadcast
///
/// BNB Testnet playbook (chain id 97):
///   PUVEXA_TREASURY=0x... PUVEXA_ADMIN=0x... PUVEXA_ANCHOR=0x... \
///   PUVEXA_REWARD_SIGNER=0x... PUVEXA_SLASH_VAULT=0x... \
///   PUVEXA_ARTIFACT=deployments/bnb-testnet.json \
///   forge script script/Deploy.s.sol \
///     --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545 \
///     --private-key <deployer-key> --broadcast --verify
///
/// Deployment transaction hashes are recorded by `scripts/collect_deploy_txs.py`, which merges the
/// forge broadcast receipts (`broadcast/Deploy.s.sol/<chainId>/run-latest.json`) into the artifact.
///
/// Production hardening happens at configuration time (multisig treasury/owner, restricted signer,
/// slash vault). Mainnet is additionally refused by the app at runtime.
contract Deploy is Script {
    struct Deployed {
        address token;
        address registry;
        address stakeVault;
        address distributor;
        address rewardSigner;
        address treasury;
        address admin;
        address slashVault;
        address deployer;
        address anchor;
        uint256 fundWei;
    }

    function run() public {
        vm.startBroadcast();
        Deployed memory d = _deploy();
        vm.stopBroadcast();
        _writeJson(d, vm.envOr("PUVEXA_ARTIFACT", string("deployments/local.json")));
        _log(d);
    }

    function _deploy() internal returns (Deployed memory d) {
        address sender = msg.sender;
        d.deployer = sender;
        d.treasury = _addr("PUVEXA_TREASURY", sender);
        d.admin = _addr("PUVEXA_ADMIN", sender);
        d.slashVault = _addr("PUVEXA_SLASH_VAULT", sender);
        d.rewardSigner = _addr("PUVEXA_REWARD_SIGNER", sender);
        d.anchor = _addr("PUVEXA_ANCHOR", sender);
        uint256 slashBps = vm.envOr("PUVEXA_SLASH_BPS", uint256(2500));
        uint256 fundFix = vm.envOr("PUVEXA_FUND_FIX", uint256(100_000));

        PuvexaFIXAI token = new PuvexaFIXAI(d.treasury);
        ContributionRegistry registry = new ContributionRegistry(d.anchor);
        ContributionStakeVault vault = new ContributionStakeVault(address(token), d.slashVault, slashBps, d.admin);
        RewardDistributor distributor = new RewardDistributor(address(token), d.admin, d.rewardSigner);

        d.token = address(token);
        d.registry = address(registry);
        d.stakeVault = address(vault);
        d.distributor = address(distributor);
        d.fundWei = fundFix * 10 ** 18;

        // Fund the distributor so prepared claims can be settled on-chain.
        token.transfer(address(distributor), d.fundWei);
    }

    function _writeJson(Deployed memory d, string memory artifact) internal {
        // Built through the forge JSON serializer: a single string.concat of every field
        // overflows the EVM stack ("Stack too deep").
        string memory obj = "puvexa-deployment";
        string memory json = vm.serializeString(obj, "network", _networkName());
        json = vm.serializeUint(obj, "chainId", block.chainid);
        json = vm.serializeUint(obj, "deploymentBlock", block.number);
        json = vm.serializeUint(obj, "deployedAt", block.timestamp);
        json = vm.serializeAddress(obj, "deployer", d.deployer);
        json = vm.serializeAddress(obj, "treasury", d.treasury);
        json = vm.serializeAddress(obj, "admin", d.admin);
        json = vm.serializeAddress(obj, "operator", d.admin);
        json = vm.serializeAddress(obj, "slashVault", d.slashVault);
        json = vm.serializeAddress(obj, "rewardSigner", d.rewardSigner);
        json = vm.serializeAddress(obj, "registryAnchor", d.anchor);
        json = vm.serializeAddress(obj, "token", d.token);
        json = vm.serializeAddress(obj, "registry", d.registry);
        json = vm.serializeAddress(obj, "stakeVault", d.stakeVault);
        json = vm.serializeAddress(obj, "distributor", d.distributor);
        json = vm.serializeString(obj, "distributorFundingWei", vm.toString(d.fundWei));
        vm.writeJson(json, artifact);
    }

    function _networkName() internal view returns (string memory) {
        if (block.chainid == 97) return "bnb-smart-chain-testnet";
        if (block.chainid == 56) return "bnb-smart-chain";
        if (block.chainid == 31337) return "anvil";
        return "unknown";
    }

    function _log(Deployed memory d) internal view {
        console2.log("PUVEXA_DEPLOYED", block.chainid);
        console2.log("PUVEXA_TOKEN_ADDRESS", d.token);
        console2.log("PUVEXA_REGISTRY_ADDRESS", d.registry);
        console2.log("PUVEXA_STAKE_VAULT_ADDRESS", d.stakeVault);
        console2.log("PUVEXA_DISTRIBUTOR_ADDRESS", d.distributor);
        console2.log("PUVEXA_REWARD_SIGNER_ADDRESS", d.rewardSigner);
        console2.log("PUVEXA_TREASURY_ADDRESS", d.treasury);
        console2.log("PUVEXA_ANCHOR_ADDRESS", d.anchor);
        console2.log("PUVEXA_DEPLOYMENT_BLOCK", block.number);
        console2.log("artifact written (deployment tx hashes: scripts/collect_deploy_txs.py)");
    }

    function _addr(string memory name, address fallbackValue) internal returns (address) {
        string memory raw = vm.envOr(name, string(""));
        return bytes(raw).length == 0 ? fallbackValue : vm.parseAddress(raw);
    }
}