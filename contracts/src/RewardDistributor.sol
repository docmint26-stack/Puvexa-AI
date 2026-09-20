// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title Puvexa Reward Distributor
/// @notice Settles Puvexa off-chain reward ledger entries on-chain via EIP-712 authorized claims.
/// @dev The distributor NEVER mints. It pays out tokens that were transferred to it by the treasury.
///      The blockchain only settles pre-authorized, policy-approved rewards; it never judges fix quality.
contract RewardDistributor is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Claim {
        bytes32 claimId;
        address recipient;
        uint256 amount;
        uint256 deadline;
    }

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 claimId,address recipient,uint256 amount,uint256 deadline)");

    IERC20 public immutable token;

    /// @notice Backend reward-signing address that authorizes on-chain claims.
    address public authorizedSigner;

    /// @notice claimId => true once successfully paid. Replay is impossible.
    mapping(bytes32 => bool) public consumed;

    /// @notice claimId => recipient paid, for independent confirmation of settlement.
    mapping(bytes32 => address) public paidRecipient;

    event ClaimPaid(bytes32 indexed claimId, address indexed recipient, uint256 amount, uint256 deadline);
    event AuthorizedSignerChanged(address indexed previousSigner, address indexed newSigner);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    /// @param token_ The FIXAI token this distributor pays out (must be transferred in by the treasury).
    /// @param owner_ Owner of the distributor (production: multisig).
    /// @param signer_ Initial authorized reward signer (backend EIP-712 signing key).
    constructor(address token_, address owner_, address signer_) EIP712("Puvexa Reward Distributor", "1") Ownable(owner_) {
        require(token_ != address(0), "RewardDistributor: zero token");
        require(signer_ != address(0), "RewardDistributor: zero signer");
        token = IERC20(token_);
        authorizedSigner = signer_;
    }

    /// @dev Executes an authorized claim. Reverts on expiry, replay, invalid signer, insufficient balance.
    function claim(Claim calldata c, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
        returns (bool)
    {
        // forge-lint: disable-next-line(block-timestamp) -- deadlines are signed by the backend and checked by expiry.
        require(block.timestamp <= c.deadline, "RewardDistributor: expired");
        require(!consumed[c.claimId], "RewardDistributor: already claimed");
        require(c.recipient != address(0), "RewardDistributor: zero recipient");
        require(c.amount > 0, "RewardDistributor: zero amount");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_TYPEHASH, c.claimId, c.recipient, c.amount, c.deadline))
        );
        address signer = ECDSA.recover(digest, signature);
        require(signer == authorizedSigner, "RewardDistributor: invalid signature");

        // checks-effects-interactions
        consumed[c.claimId] = true;
        paidRecipient[c.claimId] = c.recipient;

        require(token.balanceOf(address(this)) >= c.amount, "RewardDistributor: insufficient balance");
        emit ClaimPaid(c.claimId, c.recipient, c.amount, c.deadline);
        token.safeTransfer(c.recipient, c.amount);

        return true;
    }

    /// @notice Rotates the reward signer (owner only).
    function setAuthorizedSigner(address signer_) external onlyOwner {
        require(signer_ != address(0), "RewardDistributor: zero signer");
        emit AuthorizedSignerChanged(authorizedSigner, signer_);
        authorizedSigner = signer_;
    }

    /// @notice Emergency pause. New claims fail; previously claimed transactions remain final on-chain.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescue of accidentally deposited tokens (owner only). Cannot affect already-settled claims.
    function rescue(address token_, address to_, uint256 amount_) external onlyOwner {
        require(to_ != address(0), "RewardDistributor: zero recipient");
        IERC20(token_).safeTransfer(to_, amount_);
        emit TokensRescued(token_, to_, amount_);
    }
}