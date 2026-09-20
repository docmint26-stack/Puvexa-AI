// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Puvexa FIXAI
/// @notice ERC-20 utility token for the Puvexa AI ecosystem.
/// @dev Fixed supply of 1,000,000,000 FIXAI, minted exactly once at deployment to a treasury.
///      No minting, no burning, no transfer tax, no hidden mechanics.
///      Testnet may use a deployer-controlled treasury; production requires a secure multisig treasury.
contract PuvexaFIXAI is ERC20 {
    /// @notice Fixed maximum supply: 1,000,000,000 * 10**18 wei.
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    /// @notice Address that received the entire fixed supply at deployment.
    address public immutable treasury;

    event TreasuryMinted(address indexed treasury, uint256 amount);

    constructor(address treasury_) ERC20("Puvexa FIXAI", "FIXAI") {
        require(treasury_ != address(0), "PuvexaFIXAI: zero treasury");
        treasury = treasury_;
        _mint(treasury_, MAX_SUPPLY);
        emit TreasuryMinted(treasury_, MAX_SUPPLY);
    }
}