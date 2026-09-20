// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PuvexaFIXAI} from "../src/PuvexaFIXAI.sol";
import {ContributionStakeVault} from "../src/ContributionStakeVault.sol";

contract ContributionStakeVaultTest is Test {
    PuvexaFIXAI internal token;
    ContributionStakeVault internal vault;

    address internal admin = address(0xAD);
    address internal operator = address(0xf0c0de);
    address internal attacker = address(0xA77);
    address internal slashVault = address(0x51a5e);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant USER_FUNDS = 100 * 10**18;

    function setUp() public {
        token = new PuvexaFIXAI(address(this));
        vault = new ContributionStakeVault(address(token), slashVault, 5000, admin); // 50% slash default
        bytes32 operatorRole = vault.OPERATOR_ROLE();
        vm.prank(admin);
        vault.grantRole(operatorRole, operator);

        token.transfer(alice, USER_FUNDS);
        token.transfer(bob, USER_FUNDS);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        token.approve(address(vault), type(uint256).max);
    }

    function testStakeLocksFunds() public {
        vm.prank(alice);
        vault.stake(keccak256("contribution-1"), 5 * 10**18);
        assertEq(token.balanceOf(address(vault)), 5 * 10**18);
        assertEq(token.balanceOf(alice), USER_FUNDS - 5 * 10**18);
        (bytes32 id, address wallet, uint256 amount, ContributionStakeVault.StakeStatus status,) = vault.stakes(keccak256("contribution-1"));
        assertEq(id, keccak256("contribution-1"));
        assertEq(wallet, alice);
        assertEq(amount, 5 * 10**18);
        assertEq(uint256(status), uint256(ContributionStakeVault.StakeStatus.LOCKED));
    }

    function testDuplicateStakeReverts() public {
        bytes32 id = keccak256("contribution-dupe");
        vm.prank(alice);
        vault.stake(id, 1);
        vm.expectRevert("ContributionStakeVault: duplicate stake");
        vm.prank(alice);
        vault.stake(id, 1);
    }

    function testZeroStakeReverts() public {
        vm.expectRevert("ContributionStakeVault: zero amount");
        vm.prank(alice);
        vault.stake(keccak256("zero"), 0);
    }

    function testReleaseReturnsStake() public {
        bytes32 id = keccak256("contribution-rel");
        vm.prank(alice);
        vault.stake(id, 5 * 10**18);
        vm.prank(operator);
        vault.release(id);
        assertEq(token.balanceOf(alice), USER_FUNDS);
        (, , , ContributionStakeVault.StakeStatus status,) = vault.stakes(id);
        assertEq(uint256(status), uint256(ContributionStakeVault.StakeStatus.RELEASED));
    }

    function testFullSlashSendsToSlashVault() public {
        bytes32 id = keccak256("contribution-slash-full");
        vm.prank(bob);
        vault.stake(id, 5 * 10**18);
        vm.prank(admin);
        vault.setSlashBps(10000);
        vm.prank(operator);
        vault.slash(id);
        assertEq(token.balanceOf(slashVault), 5 * 10**18);
        assertEq(token.balanceOf(bob), USER_FUNDS - 5 * 10**18);
        (, , , ContributionStakeVault.StakeStatus status,) = vault.stakes(id);
        assertEq(uint256(status), uint256(ContributionStakeVault.StakeStatus.SLASHED));
    }

    function testPartialSlashSplits() public {
        bytes32 id = keccak256("contribution-slash-half");
        vm.prank(bob);
        vault.stake(id, 10 * 10**18);
        assertEq(vault.slashBps(), 5000);
        vm.prank(operator);
        vault.slash(id);
        assertEq(token.balanceOf(slashVault), 5 * 10**18);
        assertEq(token.balanceOf(bob), USER_FUNDS - 5 * 10**18);
    }

    function testUnauthorizedReleaseReverts() public {
        bytes32 id = keccak256("contribution-unrel");
        vm.prank(alice);
        vault.stake(id, 1);
        vm.expectRevert();
        vm.prank(attacker);
        vault.release(id);
    }

    function testUnauthorizedSlashReverts() public {
        bytes32 id = keccak256("contribution-unslash");
        vm.prank(alice);
        vault.stake(id, 1);
        vm.expectRevert();
        vm.prank(attacker);
        vault.slash(id);
    }

    function testDoubleReleaseReverts() public {
        bytes32 id = keccak256("contribution-drel");
        vm.prank(alice);
        vault.stake(id, 1);
        vm.prank(operator);
        vault.release(id);
        vm.expectRevert("ContributionStakeVault: not locked");
        vm.prank(operator);
        vault.release(id);
    }

    function testDoubleSlashReverts() public {
        bytes32 id = keccak256("contribution-dslash");
        vm.prank(alice);
        vault.stake(id, 1);
        vm.prank(operator);
        vault.slash(id);
        vm.expectRevert("ContributionStakeVault: not locked");
        vm.prank(operator);
        vault.slash(id);
    }

    function testUnknownContributionReverts() public {
        vm.expectRevert("ContributionStakeVault: stake not found");
        vm.prank(operator);
        vault.release(keccak256("never-staked"));
    }

    function testAdminSetsSlashVaultAndBps() public {
        vm.prank(admin);
        vault.setSlashVault(address(0x999));
        assertEq(vault.slashVault(), address(0x999));
        vm.prank(admin);
        vault.setSlashBps(0);
        assertEq(vault.slashBps(), 0);
        vm.expectRevert("ContributionStakeVault: bps out of range");
        vm.prank(admin);
        vault.setSlashBps(10001);
    }

    function testAdminCanAddOperator() public {
        bytes32 operatorRole = vault.OPERATOR_ROLE();
        vm.prank(admin);
        vault.grantRole(operatorRole, attacker);
        bytes32 id = keccak256("contribution-oper");
        vm.prank(alice);
        vault.stake(id, 1);
        vm.prank(attacker);
        vault.release(id);
    }

    /// @notice Property: a stake is settled (released OR slashed) exactly once for arbitrary parameters.
    function testFuzzSettlementExactlyOnce(bytes32 contributionId, uint256 amount, bool slashFirst) public {
        uint256 bounded = (amount % (USER_FUNDS / 2)) + 1;
        vm.assume(bounded > 0 && bounded <= USER_FUNDS);
        vm.prank(alice);
        vault.stake(contributionId, bounded);

        if (slashFirst) {
            vm.prank(operator);
            vault.slash(contributionId);
            vm.expectRevert("ContributionStakeVault: not locked");
            vm.prank(operator);
            vault.release(contributionId);
        } else {
            vm.prank(operator);
            vault.release(contributionId);
            vm.expectRevert("ContributionStakeVault: not locked");
            vm.prank(operator);
            vault.slash(contributionId);
        }
    }
}