// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PuvexaFIXAI} from "../src/PuvexaFIXAI.sol";

contract PuvexaFIXAITest is Test {
    PuvexaFIXAI internal token;
    address internal treasury = address(0xBEEF);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        token = new PuvexaFIXAI(treasury);
    }

    function testFixedSupplyMintedOnce() public view {
        assertEq(token.totalSupply(), token.MAX_SUPPLY());
        assertEq(token.MAX_SUPPLY(), 1_000_000_000 * 10**18);
        assertEq(token.balanceOf(treasury), token.MAX_SUPPLY());
    }

    function testNameSymbolDecimals() public view {
        assertEq(token.name(), "Puvexa FIXAI");
        assertEq(token.symbol(), "FIXAI");
        assertEq(token.decimals(), 18);
    }

    function testNormalTransfer() public {
        vm.prank(treasury);
        token.transfer(alice, 8 * 10**18);
        assertEq(token.balanceOf(alice), 8 * 10**18);
        assertEq(token.balanceOf(treasury), token.MAX_SUPPLY() - 8 * 10**18);

        vm.startPrank(alice);
        token.transfer(bob, 3 * 10**18);
        vm.stopPrank();
        assertEq(token.balanceOf(alice), 5 * 10**18);
        assertEq(token.balanceOf(bob), 3 * 10**18);
    }

    function testTransferAboveBalanceReverts() public {
        vm.prank(treasury);
        token.transfer(alice, 1 * 10**18);
        vm.expectRevert();
        vm.prank(alice);
        token.transfer(bob, 2 * 10**18);
    }

    function testZeroTreasuryReverts() public {
        vm.expectRevert("PuvexaFIXAI: zero treasury");
        new PuvexaFIXAI(address(0));
    }

    /// @notice Property: total supply is invariant regardless of wallet activity.
    function testFuzzSupplyInvariant(address fromSeed, uint256 splitSeed) public {
        uint256 amount1 = 1 + (uint256(keccak256(abi.encode(fromSeed, splitSeed))) % (token.MAX_SUPPLY() / 2));
        vm.prank(treasury);
        token.transfer(alice, amount1);
        vm.prank(alice);
        token.transfer(bob, amount1 / 2);
        assertEq(token.totalSupply(), token.MAX_SUPPLY());
        uint256 sum = token.balanceOf(treasury) + token.balanceOf(alice) + token.balanceOf(bob);
        assertEq(sum, token.MAX_SUPPLY());
    }
}