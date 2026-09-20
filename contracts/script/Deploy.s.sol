// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PuvexaFIXAI} from "../src/PuvexaFIXAI.sol";
import {ContributionRegistry} from "../src/ContributionRegistry.sol";
import {ContributionStakeVault} from "../src/ContributionStakeVault.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";

/// @title Puvexa local deployment script
/// @notice Deploys the full Puvexa token economy onto a live (Anvil/testnet) chain and funds the
///         RewardDistributor so claims can be settled. Writes `deployments/local.json` with the
///         resolved addresses so the backend/frontend `.env` can be populated consistently.
///
/// Testnet playbook:
///   forge script script/Deploy.s.sol \
///     --rpc-url http://127.0.0.1:8545 \
///     --private-key <anvil-key-1> --broadcast
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
        uint256 slashBps = vm.envOr("PUVEXA_SLASH_BPS", uint256(2500));
        uint256 fundFix = vm.envOr("PUVEXA_FUND_FIX", uint256(100_000));

        PuvexaFIXAI token = new PuvexaFIXAI(d.treasury);
        ContributionRegistry registry = new ContributionRegistry(_addr("PUVEXA_ANCHOR", sender));
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
        string memory json = string.concat(
            '{"chainId":', vm.toString(block.chainid),
            ',"deployer":"', vm.toString(d.deployer),
            '","treasury":"', vm.toString(d.treasury),
            '","admin":"', vm.toString(d.admin),
            '","slashVault":"', vm.toString(d.slashVault),
            '","rewardSigner":"', vm.toString(d.rewardSigner),
            '","token":"', vm.toString(d.token),
            '","registry":"', vm.toString(d.registry),
            '","stakeVault":"', vm.toString(d.stakeVault),
            '","distributor":"', vm.toString(d.distributor),
            '","distributorFundingWei":"', vm.toString(d.fundWei),
            '"}'
        );
        vm.writeFile(artifact, json);
    }

    function _log(Deployed memory d) internal view {
        console2.log("PUVEXA_DEPLOYED", block.chainid);
        console2.log("PUVEXA_TOKEN_ADDRESS", d.token);
        console2.log("PUVEXA_REGISTRY_ADDRESS", d.registry);
        console2.log("PUVEXA_STAKE_VAULT_ADDRESS", d.stakeVault);
        console2.log("PUVEXA_DISTRIBUTOR_ADDRESS", d.distributor);
        console2.log("PUVEXA_REWARD_SIGNER_ADDRESS", d.rewardSigner);
        console2.log("PUVEXA_TREASURY_ADDRESS", d.treasury);
        console2.log("deployments/local.json written");
    }

    function _addr(string memory name, address fallbackValue) internal returns (address) {
        string memory raw = vm.envOr(name, string(""));
        return bytes(raw).length == 0 ? fallbackValue : vm.parseAddress(raw);
    }
}