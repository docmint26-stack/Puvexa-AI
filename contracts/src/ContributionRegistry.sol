// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Puvexa Contribution Registry
/// @notice Privacy-safe proof anchor for accepted contribution attribution.
/// @dev Stores ONLY hashes and identifiers required for attribution anchoring. Full source code, logs,
///      screenshots, or personal information are NEVER stored on-chain. The backend remains the
///      authoritative attribution source; this contract anchors cryptographic proof of acceptance.
contract ContributionRegistry is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    struct Proof {
        bytes32 contentHash;
        bytes32 versionHash;
        address wallet;
        uint256 timestamp;
        uint32 version;
        bool anchored;
    }

    /// @notice contributionId (keccak of the server contribution id) => immutable proof history root.
    /// @dev The latest entry is authoritative; older versions remain readable for audit.
    mapping(bytes32 => Proof[]) public proofs;

    event ContributionRegistered(
        bytes32 indexed contributionId, bytes32 contentHash, bytes32 versionHash, address indexed wallet, uint32 version
    );

    constructor(address anchor_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ANCHOR_ROLE, anchor_);
    }

    /// @notice Anchors a privacy-safe proof of an accepted contribution. Anchoring requires the
    ///         ANCHOR_ROLE (backend policy, not an AI component). An explicit witness is optional.
    /// @dev A contribution id can only ever be anchored once. Re-anchoring requires `updateProof`
    ///      with an explicit new version hash (version mechanism), never silent overwrite.
    function registerProof(bytes32 contributionId, bytes32 contentHash, bytes32 versionHash, address wallet)
        external
        onlyRole(ANCHOR_ROLE)
    {
        require(contributionId != bytes32(0), "ContributionRegistry: zero contributionId");
        require(contentHash != bytes32(0), "ContributionRegistry: zero contentHash");
        require(versionHash != bytes32(0), "ContributionRegistry: zero versionHash");
        require(wallet != address(0), "ContributionRegistry: zero wallet");
        require(!_anchored(contributionId, versionHash), "ContributionRegistry: duplicate registration");

        proofs[contributionId].push(
            Proof({contentHash: contentHash, versionHash: versionHash, wallet: wallet, timestamp: block.timestamp, version: 1, anchored: true})
        );
        emit ContributionRegistered(contributionId, contentHash, versionHash, wallet, 1);
    }

    /// @notice Records an explicit corrected version of an already-anchored contribution.
    function updateProof(bytes32 contributionId, bytes32 versionHash)
        external
        onlyRole(ANCHOR_ROLE)
        returns (uint32 newVersion)
    {
        Proof[] storage history = proofs[contributionId];
        require(history.length > 0, "ContributionRegistry: not registered");
        Proof storage latest = history[history.length - 1];
        require(latest.versionHash != versionHash, "ContributionRegistry: same version");
        require(versionHash != bytes32(0), "ContributionRegistry: zero versionHash");

        // A correction must reference the same accepted content; only the version hash moves forward.
        Proof memory prev = latest;
        Proof memory next = Proof({
            contentHash: prev.contentHash,
            versionHash: versionHash,
            wallet: prev.wallet,
            timestamp: block.timestamp,
            version: prev.version + 1,
            anchored: true
        });
        history.push(next);
        emit ContributionRegistered(contributionId, next.contentHash, next.versionHash, next.wallet, next.version);
        return next.version;
    }

    function proofOf(bytes32 contributionId) external view returns (Proof memory) {
        Proof[] storage history = proofs[contributionId];
        require(history.length > 0, "ContributionRegistry: not registered");
        return history[history.length - 1];
    }

    function historyOf(bytes32 contributionId) external view returns (Proof[] memory) {
        return proofs[contributionId];
    }

    function _anchored(bytes32 contributionId, bytes32 versionHash) internal view returns (bool) {
        Proof[] storage history = proofs[contributionId];
        for (uint256 i; i < history.length; i++) {
            if (history[i].versionHash == versionHash) {
                return true;
            }
        }
        return false;
    }
}