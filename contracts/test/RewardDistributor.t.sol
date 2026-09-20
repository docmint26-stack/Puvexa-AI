// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PuvexaFIXAI} from "../src/PuvexaFIXAI.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";

contract RewardDistributorTest is Test {
    PuvexaFIXAI internal token;
    RewardDistributor internal distributor;

    address internal owner = address(0xa11c3);
    address internal signer = address(0x5166e7);
    uint256 internal signerKey = 0xA11CE;
    address internal alice = address(0xA11CE9);
    address internal bob = address(0xB0B11);

    bytes32 internal constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 claimId,address recipient,uint256 amount,uint256 deadline)");

    uint256 internal constant MINTS = 100_000 * 10**18;

    function setUp() public {
        // signer key corresponds to `signer` address loaded by vm.addr.
        signer = vm.addr(signerKey);
        token = new PuvexaFIXAI(address(this));
        distributor = new RewardDistributor(address(token), owner, signer);
        // Treasury funds the distributor directly (token supply is separated from eligibility).
        token.transfer(address(distributor), MINTS);
    }

    function _digest(RewardDistributor.Claim memory c) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Puvexa Reward Distributor"),
                keccak256("1"),
                block.chainid,
                address(distributor)
            )
        );
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, c.claimId, c.recipient, c.amount, c.deadline));
        return keccak256(abi.encodePacked(bytes2(0x1901), domainSeparator, structHash));
    }

    function _sign(RewardDistributor.Claim memory c, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _digest(c));
        return abi.encodePacked(r, s, v);
    }

    function _claim(RewardDistributor.Claim memory c, bytes memory signature) internal returns (bool) {
        return distributor.claim(c, signature);
    }

    function testValidClaimPaysRecipient() public {
        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: keccak256("c1"), recipient: alice, amount: 8 * 10**18, deadline: block.timestamp + 1 days});
        uint256 balanceBefore = token.balanceOf(alice);
        assertTrue(_claim(c, _sign(c, signerKey)));
        assertEq(token.balanceOf(alice), balanceBefore + 8 * 10**18);
        assertTrue(distributor.consumed(c.claimId));
        assertEq(distributor.paidRecipient(c.claimId), alice);
    }

    function testInvalidSignerReverts() public {
        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: keccak256("c2"), recipient: alice, amount: 1, deadline: block.timestamp + 1 days});
        bytes memory sig = _sign(c, 0xBAD);
        vm.expectRevert("RewardDistributor: invalid signature");
        _claim(c, sig);
    }

    function testWrongRecipientReverts() public {
        // Signature authorizes alice; payload is mutated to bob.
        RewardDistributor.Claim memory signed =
            RewardDistributor.Claim({claimId: keccak256("c3"), recipient: alice, amount: 5, deadline: block.timestamp + 1 days});
        bytes memory sig = _sign(signed, signerKey);
        RewardDistributor.Claim memory altered =
            RewardDistributor.Claim({claimId: keccak256("c3"), recipient: bob, amount: 5, deadline: block.timestamp + 1 days});
        vm.expectRevert("RewardDistributor: invalid signature");
        _claim(altered, sig);
    }

    function testWrongAmountReverts() public {
        RewardDistributor.Claim memory signed =
            RewardDistributor.Claim({claimId: keccak256("c4"), recipient: alice, amount: 5, deadline: block.timestamp + 1 days});
        bytes memory sig = _sign(signed, signerKey);
        RewardDistributor.Claim memory altered =
            RewardDistributor.Claim({claimId: keccak256("c4"), recipient: alice, amount: 5_000_001, deadline: block.timestamp + 1 days});
        vm.expectRevert("RewardDistributor: invalid signature");
        _claim(altered, sig);
    }

    function testExpiredClaimReverts() public {
        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: keccak256("c5"), recipient: alice, amount: 1, deadline: block.timestamp - 1});
        bytes memory sig = _sign(c, signerKey);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert("RewardDistributor: expired");
        _claim(c, sig);
    }

    function testReplayReverts() public {
        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: keccak256("c6"), recipient: alice, amount: 1, deadline: block.timestamp + 1 days});
        bytes memory sig = _sign(c, signerKey);
        assertTrue(_claim(c, sig));
        vm.expectRevert("RewardDistributor: already claimed");
        _claim(c, sig);
    }

    function testPausedRevertsAndUnpauses() public {
        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: keccak256("c7"), recipient: alice, amount: 1, deadline: block.timestamp + 1 days});
        bytes memory sig = _sign(c, signerKey);
        vm.prank(owner);
        distributor.pause();
        vm.expectRevert();
        _claim(c, sig);
        vm.prank(owner);
        distributor.unpause();
        assertTrue(_claim(c, sig));
    }

    function testInsufficientBalanceReverts() public {
        RewardDistributor.Claim memory c = RewardDistributor.Claim({
            claimId: keccak256("c8"),
            recipient: alice,
            amount: MINTS + 1,
            deadline: block.timestamp + 1 days
        });
        bytes memory sig = _sign(c, signerKey);
        vm.expectRevert("RewardDistributor: insufficient balance");
        _claim(c, sig);
    }

    function testOwnerRotatesSigner() public {
        address newSigner = vm.addr(0xBEEF);
        vm.prank(owner);
        distributor.setAuthorizedSigner(newSigner);
        assertEq(distributor.authorizedSigner(), newSigner);

        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: keccak256("c9"), recipient: alice, amount: 1, deadline: block.timestamp + 1 days});
        vm.expectRevert("RewardDistributor: invalid signature");
        _claim(c, _sign(c, signerKey)); // old signer no longer valid
        assertTrue(_claim(c, _sign(c, 0xBEEF)));
    }

    function testOnlyOwnerRotatesSigner() public {
        vm.expectRevert();
        vm.prank(alice);
        distributor.setAuthorizedSigner(alice);
    }

    function testOwnerRescue() public {
        uint256 before = token.balanceOf(bob);
        vm.prank(owner);
        distributor.rescue(address(token), bob, 100);
        assertEq(token.balanceOf(bob), before + 100);
    }

    /// @notice Property: a claim can NEVER succeed twice, for any distinct id/deadline values.
    function testFuzzClaimUsedOnce(bytes32 claimId, address recipient, uint256 amount, uint256 deadlineOffset) public {
        vm.assume(recipient != address(0));
        uint256 boundedAmount = (amount % (MINTS / 2)) + 1;
        uint256 deadline = block.timestamp + (deadlineOffset % 30 days) + 1;
        RewardDistributor.Claim memory c =
            RewardDistributor.Claim({claimId: claimId, recipient: recipient, amount: boundedAmount, deadline: deadline});
        bytes memory sig = _sign(c, signerKey);
        assertTrue(_claim(c, sig));
        vm.expectRevert("RewardDistributor: already claimed");
        _claim(c, sig);
    }
}