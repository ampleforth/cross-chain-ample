// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title TokenVault
 * @dev This is a holder contract for Tokens which will be deployed on the base chain (Ethereum).
 *
 *      When a user transfers Tokens from the base to a satellite chain
 *      Tokens are 'locked' in this vault contract
 *      and 'bridge-secured' Tokens (xc-tokens) are 'mint' on the satellite chain.
 *      This vault contract transfers Tokens from the depositor's wallet to itself.
 *
 *      When a user transfers xc-tokens from a satellite chain back to the base chain
 *      through a chain-bridge instance, xc-tokens are 'burnt' on a satellite chain
 *      and locked Tokens are 'unlocked' from this vault contract on the base chain.
 *      The vault contract transfers Tokens from itself to the recipient's wallet.
 *
 *      The vault owner curates a list of bridge-gateways which are allowed to
 *      lock and unlock tokens.
 *
 */
contract TokenVault is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event GatewayLocked(
        address indexed bridgeGateway,
        address indexed token,
        address indexed depositor,
        uint256 amount
    );

    event GatewayUnlocked(
        address indexed bridgeGateway,
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    event GatewayWhitelistUpdated(address indexed bridgeGateway, bool active);

    // White-list of trusted bridge gateway contracts
    mapping(address => bool) public whitelistedBridgeGateways;

    modifier onlyBridgeGateway() {
        require(
            whitelistedBridgeGateways[msg.sender],
            "TokenVault: Bridge gateway not whitelisted"
        );
        _;
    }

    /**
     * @notice Adds bridge gateway contract address to whitelist.
     * @param bridgeGateway The address of the bridge gateway contract.
     */
    function addBridgeGateway(address bridgeGateway) external onlyOwner {
        require(
            !whitelistedBridgeGateways[bridgeGateway],
            "TokenVault: Bridge gateway already whitelisted"
        );

        whitelistedBridgeGateways[bridgeGateway] = true;
        emit GatewayWhitelistUpdated(bridgeGateway, true);
    }

    /**
     * @notice Removes bridge gateway contract address from whitelist.
     * @param bridgeGateway The address of the bridge gateway contract.
     */
    function removeBridgeGateway(address bridgeGateway) external onlyOwner {
        require(
            whitelistedBridgeGateways[bridgeGateway],
            "TokenVault: Bridge gateway not whitelisted"
        );

        delete whitelistedBridgeGateways[bridgeGateway];
        emit GatewayWhitelistUpdated(bridgeGateway, false);
    }

    /**
     * @notice Transfers specified amount from the depositor's wallet and locks it in the gateway contract.
     * @param token address of the token to lock.
     * @param depositor address of wallet to transfer specified token from
     * @param amount amount of tokens to transfer
     */
    function lock(
        address token,
        address depositor,
        uint256 amount
    ) external onlyBridgeGateway {
        IERC20(token).safeTransferFrom(depositor, address(this), amount);
        emit GatewayLocked(msg.sender, token, depositor, amount);
    }

    /**
     * @notice Unlocks the specified amount from the gateway contract and transfers it to the recipient.
     * @param token address of the token to unlock.
     * @param recipient address of wallet to transfer specified token to
     * @param amount amount of tokens to transfer
     */
    function unlock(
        address token,
        address recipient,
        uint256 amount
    ) external onlyBridgeGateway {
        IERC20(token).safeTransfer(recipient, amount);
        emit GatewayUnlocked(msg.sender, token, recipient, amount);
    }

    /**
     * @notice Total balance of the specified token, held by this vault.
     * @param token address of the token to check.
     */
    function totalLocked(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
