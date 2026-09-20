// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Puvexa Contribution Stake Vault
/// @notice Contribution-quality / anti-abuse security stake. NOT yield farming.
/// @dev Locks FIXAI behind an eligible contribution. Protocol operators (backend policy + manual review)
///      release or slash the stake. Slashing is role-controlled and never driven by an AI model alone.
contract ContributionStakeVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum StakeStatus {
        LOCKED,
        RELEASED,
        SLASHED
    }

    struct Stake {
        bytes32 contributionId;
        address wallet;
        uint256 amount;
        StakeStatus status;
        uint256 lockedAt;
    }

    IERC20 public immutable token;

    /// @notice contributionId => stake (one active stake per contribution).
    mapping(bytes32 => Stake) public stakes;

    /// @notice Address that receives slashed tokens (testnet: treasury).
    address public slashVault;

    /// @dev Portion of a stake slashed on fraud review, in basis points (0-10000).
    uint256 public slashBps;

    event Staked(bytes32 indexed contributionId, address indexed wallet, uint256 amount);
    event Released(bytes32 indexed contributionId, address indexed wallet, uint256 amount);
    event Slashed(bytes32 indexed contributionId, address indexed wallet, uint256 slashedAmount, uint256 returnedAmount);
    event SlashVaultChanged(address indexed previousVault, address indexed newVault);
    event SlashBpsChanged(uint256 previousBps, uint256 newBps);

    constructor(address token_, address slashVault_, uint256 slashBps_, address admin_) {
        require(token_ != address(0), "ContributionStakeVault: zero token");
        require(slashVault_ != address(0), "ContributionStakeVault: zero slash vault");
        require(slashBps_ <= 10000, "ContributionStakeVault: bps out of range");
        token = IERC20(token_);
        slashVault = slashVault_;
        slashBps = slashBps_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
    }

    /// @notice Locks `amount` FIXAI behind a contribution. Caller must have approved the vault.
    /// @dev The required stake amount is decided by server policy and signed into the contribution proof;
    ///      the vault is intentionally custodial to make slash/release atomic on-chain.
    function stake(bytes32 contributionId, uint256 amount) external nonReentrant returns (bool) {
        require(amount > 0, "ContributionStakeVault: zero amount");
        Stake storage s = stakes[contributionId];
        require(!_exists(s), "ContributionStakeVault: duplicate stake");

        token.safeTransferFrom(msg.sender, address(this), amount);

        s.contributionId = contributionId;
        s.wallet = msg.sender;
        s.amount = amount;
        s.status = StakeStatus.LOCKED;
        s.lockedAt = block.timestamp;

        emit Staked(contributionId, msg.sender, amount);
        return true;
    }

    /// @notice Returns a stake to its owner after verified acceptance (operator only).
    function release(bytes32 contributionId) external nonReentrant onlyRole(OPERATOR_ROLE) returns (uint256) {
        Stake storage s = _lockedOrRevert(contributionId);
        uint256 amount = s.amount;
        s.status = StakeStatus.RELEASED;
        emit Released(contributionId, s.wallet, amount);
        token.safeTransfer(s.wallet, amount);
        return amount;
    }

    /// @notice Slashes a stake after policy-level (manual-review-authorized) fraud determination (operator only).
    /// @dev Applies the configured slashBps portion to slashVault; remainder is returned to the wallet.
    function slash(bytes32 contributionId) external nonReentrant onlyRole(OPERATOR_ROLE) returns (uint256 slashedAmount_) {
        Stake storage s = _lockedOrRevert(contributionId);
        uint256 amount = s.amount;
        s.status = StakeStatus.SLASHED;
        uint256 slashedAmount = (amount * slashBps) / 10000;
        uint256 returnedAmount = amount - slashedAmount;
        if (slashedAmount > 0) {
            token.safeTransfer(slashVault, slashedAmount);
        }
        if (returnedAmount > 0) {
            token.safeTransfer(s.wallet, returnedAmount);
        }
        emit Slashed(contributionId, s.wallet, slashedAmount, returnedAmount);
        return slashedAmount;
    }

    function setSlashVault(address vault_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(vault_ != address(0), "ContributionStakeVault: zero slash vault");
        emit SlashVaultChanged(slashVault, vault_);
        slashVault = vault_;
    }

    function setSlashBps(uint256 bps_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps_ <= 10000, "ContributionStakeVault: bps out of range");
        emit SlashBpsChanged(slashBps, bps_);
        slashBps = bps_;
    }

    function _exists(Stake storage s) internal view returns (bool) {
        return s.wallet != address(0);
    }

    function _lockedOrRevert(bytes32 contributionId) internal view returns (Stake storage s) {
        s = stakes[contributionId];
        require(_exists(s), "ContributionStakeVault: stake not found");
        require(s.status == StakeStatus.LOCKED, "ContributionStakeVault: not locked");
    }
}