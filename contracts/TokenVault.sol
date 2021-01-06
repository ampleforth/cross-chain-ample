// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenVault
 * @dev This is a holder contract for Tokens which will be deployed on the 'master' chain (Ethereum).
 *
 *      When a user transfers Tokens from the master chain to another chain
 *      through a bridge, Tokens are 'locked' in this vault contract
 *      and 'bridge-secured' Tokens (xc-tokens) are 'mint' on the other chain.
 *      This vault contract transfers Tokens from the depositor's wallet to itself.
 *
 *      When a user transfers xc-tokens from another chain back to the master chain
 *      through a chain-bridge instance, xc-tokens are 'burnt' on the other chain
 *      and locked Tokens are 'unlocked' from this vault contract on the master chain.
 *      The vault contract transfers Tokens from itself to the recipient's wallet.
 *
 *      The vault owner curates a list of bridge-gateways which are allowed to
 *      lock and unlock tokens.
 *
 */
contract TokenVault is Ownable {
    using SafeMath for uint256;

    event Locked(
        address indexed bridgeGateway,
        address indexed token,
        address indexed depositor,
        uint256 amount
    );

    event Unlocked(
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
     */
    function lock(
        address token,
        address depositor,
        uint256 amount
    ) external onlyBridgeGateway {
        require(IERC20(token).transferFrom(depositor, address(this), amount));
        emit Locked(msg.sender, token, depositor, amount);
    }

    /**
     * @notice Unlocks the specified amount from the gateway contract and transfers it to the recipient.
     */
    function unlock(
        address token,
        address recipient,
        uint256 amount
    ) external onlyBridgeGateway {
        require(IERC20(token).transfer(recipient, amount));
        emit Unlocked(msg.sender, token, recipient, amount);
    }

    /**
     * @notice Total token balance secured by the gateway contract.
     */
    function totalLocked(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
