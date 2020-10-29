pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

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
 */
contract TokenVault is OwnableUpgradeSafe {
    using SafeMath for uint256;

    event Locked(address indexed bridgeGateway, address indexed depositor, uint256 amount);

    event Unlocked(address indexed bridgeGateway, address indexed recipient, uint256 amount);

    // Reference to the ERC-20 token contract
    address public token;

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
        whitelistedBridgeGateways[bridgeGateway] = true;
    }

    /**
     * @notice Removes bridge gateway contract address from whitelist.
     * @param bridgeGateway The address of the bridge gateway contract.
     */
    function removeBridgeGateway(address bridgeGateway) external onlyOwner {
        delete whitelistedBridgeGateways[bridgeGateway];
    }

    /**
     * @notice Transfers specified amount from the depositor's wallet and locks it in the gateway contract.
     */
    function lock(address depositor, uint256 amount) external onlyBridgeGateway {
        require(IERC20(token).transferFrom(depositor, address(this), amount));
        emit Locked(msg.sender, depositor, amount);
    }

    /**
     * @notice Unlocks the specified amount from the gateway contract and transfers it to the recipient.
     */
    function unlock(address recipient, uint256 amount) external onlyBridgeGateway {
        require(IERC20(token).transfer(recipient, amount));
        emit Unlocked(msg.sender, recipient, amount);
    }

    /**
     * @dev ZOS upgradable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract's state variables.
     */
    function initialize(address token_) public initializer {
        __Ownable_init();
        token = token_;
    }

    /**
     * @notice Total token balance secured by the gateway contract.
     */
    function totalLocked() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
