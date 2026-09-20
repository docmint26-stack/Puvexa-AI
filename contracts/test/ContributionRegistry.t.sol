// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ContributionRegistry} from "../src/ContributionRegistry.sol";

contract ContributionRegistryTest is Test {
    ContributionRegistry internal registry;
    address internal anchor = address(0xA9C4E0);
    address internal attacker = address(0xA77);
    address internal wallet = address(0xB0B);

    bytes32 internal CONTENT_HASH = keccak256("normalized accepted contribution content");
    bytes32 internal VERSION_HASH = keccak256("version-1");

    function setUp() public {
        registry = new ContributionRegistry(anchor);
    }

    function testRegisterProof() public {
        vm.prank(anchor);
        registry.registerProof(keccak256("contribution-1"), CONTENT_HASH, VERSION_HASH, wallet);
        ContributionRegistry.Proof memory p = registry.proofOf(keccak256("contribution-1"));
        assertEq(p.contentHash, CONTENT_HASH);
        assertEq(p.versionHash, VERSION_HASH);
        assertEq(p.wallet, wallet);
        assertEq(p.version, 1);
        assertTrue(p.anchored);
        assertEq(registry.historyOf(keccak256("contribution-1")).length, 1);
    }

    function testDuplicateContributionIdReverts() public {
        bytes32 id = keccak256("contribution-dupe");
        vm.startPrank(anchor);
        registry.registerProof(id, CONTENT_HASH, VERSION_HASH, wallet);
        vm.expectRevert("ContributionRegistry: duplicate registration");
        registry.registerProof(id, CONTENT_HASH, VERSION_HASH, wallet);
        vm.stopPrank();
    }

    function testInvalidCallerReverts() public {
        vm.expectRevert();
        vm.prank(attacker);
        registry.registerProof(keccak256("contribution-x"), CONTENT_HASH, VERSION_HASH, wallet);
    }

    function testVersionUpdate() public {
        bytes32 id = keccak256("contribution-ver");
        vm.startPrank(anchor);
        registry.registerProof(id, CONTENT_HASH, VERSION_HASH, wallet);
        uint32 next = registry.updateProof(id, keccak256("version-2"));
        vm.stopPrank();
        assertEq(next, 2);
        ContributionRegistry.Proof memory p = registry.proofOf(id);
        assertEq(p.version, 2);
        assertEq(p.contentHash, CONTENT_HASH); // accepted content attribution is preserved
        assertEq(p.wallet, wallet);
        assertEq(registry.historyOf(id).length, 2);
    }

    function testUpdateSameVersionReverts() public {
        bytes32 id = keccak256("contribution-samever");
        vm.startPrank(anchor);
        registry.registerProof(id, CONTENT_HASH, VERSION_HASH, wallet);
        vm.expectRevert("ContributionRegistry: same version");
        registry.updateProof(id, VERSION_HASH);
        vm.stopPrank();
    }

    function testUpdateUnregisteredReverts() public {
        vm.expectRevert("ContributionRegistry: not registered");
        vm.prank(anchor);
        registry.updateProof(keccak256("never"), keccak256("v2"));
    }

    function testZeroFieldsRevert() public {
        bytes32 id = keccak256("zero");
        vm.startPrank(anchor);
        vm.expectRevert("ContributionRegistry: zero contentHash");
        registry.registerProof(id, bytes32(0), VERSION_HASH, wallet);
        vm.expectRevert("ContributionRegistry: zero versionHash");
        registry.registerProof(id, CONTENT_HASH, bytes32(0), wallet);
        vm.expectRevert("ContributionRegistry: zero wallet");
        registry.registerProof(id, CONTENT_HASH, VERSION_HASH, address(0));
        vm.expectRevert("ContributionRegistry: zero contributionId");
        registry.registerProof(bytes32(0), CONTENT_HASH, VERSION_HASH, wallet);
        vm.stopPrank();
    }

    function testUpdateReapplyingVersionReverts() public {
        bytes32 id = keccak256("contribution-dupver");
        vm.startPrank(anchor);
        registry.registerProof(id, CONTENT_HASH, VERSION_HASH, wallet);
        registry.updateProof(id, keccak256("version-2"));
        vm.expectRevert("ContributionRegistry: same version");
        registry.updateProof(id, keccak256("version-2"));
        vm.stopPrank();
    }
}