pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "../lib/UInt256Lib.sol";

// TODO: Move all interfaces to separate source files
interface IXCAmple {
    function totalSupply() external returns (uint256);

    function rebase(uint256 epoch, uint256 totalSupply_) external returns (uint256);

    function mint(address who, uint256 value) external;

    function burn(address who, uint256 value) external;
}

interface IBatchTxExecutor {
    function executeAll() external returns (bool);
}

/**
 * @title XC(Cross-Chain)Ample Controller
 * @dev This component administers the XCAmple ERC20 token contract.
 *      It maintains a set of white-listed bridge gateway contracts which
 *      have the ability to `mint` and `burn` xcAmples. It also performs
 *      rebase on XCAmple, based on updated AMPL supply reported through
 *      the bridge gateway.
 */
contract XCAmpleController is OwnableUpgradeSafe {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using UInt256Lib for uint256;

    event GatewayMint(
        address indexed bridgeGateway,
        address indexed recipient,
        uint256 xcAmpleAmount
    );

    event GatewayBurn(
        address indexed bridgeGateway,
        address indexed depositor,
        uint256 xcAmpleAmount
    );

    event GatewayRebase(
        address indexed bridgeGateway,
        uint256 indexed epoch,
        int256 requestedSupplyAdjustment,
        uint256 timestampSec
    );

    event GatewayWhitelistUpdated(address indexed bridgeGateway, bool active);

    // Reference to the cross-chain ample token contract.
    address public xcAmple;

    // This module executes downstream notifications and
    // returns if all the notifications were executed successfully.
    address public rebaseRelayer;

    // The number of rebase cycles since inception of AMPL.
    uint256 public globalAmpleforthEpoch;

    // The timestamp when xcAmple rebase was executed.
    uint256 public lastRebaseTimestampSec;

    // White-list of trusted bridge gateway contracts
    mapping(address => bool) public whitelistedBridgeGateways;

    modifier onlyBridgeGateway() {
        require(
            whitelistedBridgeGateways[msg.sender],
            "XCAmpleController: Bridge gateway not whitelisted"
        );
        _;
    }

    /**
     * @notice Adds bridge gateway contract address to whitelist.
     * @param bridgeGateway The address of the bridge gateway contract.
     */
    function addBridgeGateway(address bridgeGateway) external onlyOwner {
        whitelistedBridgeGateways[bridgeGateway] = true;
        emit GatewayWhitelistUpdated(bridgeGateway, true);
    }

    /**
     * @notice Removes bridge gateway contract address from whitelist.
     * @param bridgeGateway The address of the bridge gateway contract.
     */
    function removeBridgeGateway(address bridgeGateway) external onlyOwner {
        whitelistedBridgeGateways[bridgeGateway] = false;
        emit GatewayWhitelistUpdated(bridgeGateway, false);
    }

    /**
     * @notice Sets the reference to the rebaseRelayer.
     * @param rebaseRelayer_ The address of the rebaseRelayer contract.
     */
    function setRebaseRelayer(address rebaseRelayer_) external onlyOwner {
        rebaseRelayer = rebaseRelayer_;
    }

    /**
     * @notice Mint xcAmples to a recipient.
     * @dev Bridge locks AMPLs on the master-chain and mints xcAmples on the current-chain.
     *
     * @param recipient The address of the recipient.
     * @param xcAmpleAmount The amount of xcAmples to be mint on the current-chain.
     */
    function mint(address recipient, uint256 xcAmpleAmount) external onlyBridgeGateway {
        IXCAmple(xcAmple).mint(recipient, xcAmpleAmount);
        emit GatewayMint(msg.sender, recipient, xcAmpleAmount);
    }

    /**
     * @notice Burn xcAmples from depositor.
     * @dev Bridge burns xcAmples on the current-chain and unlocks AMPLs on the master-chain.
     *
     * @param depositor The address of the depositor.
     * @param xcAmpleAmount The amount of xcAmples to be burnt on the current-chain.
     */
    function burn(address depositor, uint256 xcAmpleAmount) external onlyBridgeGateway {
        IXCAmple(xcAmple).burn(depositor, xcAmpleAmount);
        emit GatewayBurn(msg.sender, depositor, xcAmpleAmount);
    }

    // TODO: Move to a 2 phase rebase, https://github.com/ampleforth/ampl-bridge-solidity/commit/6095ec82fc8ca3f36af180215c9c610f23caeb28
    /**
     * @notice Initiate a new rebase operation.
     * @param newAMPLEpoch The new epoch after rebase on the master-chain.
     * @param newTotalAMPLSupply The new AMPL total supply after rebase on the master-chain.
     * @dev Bridge reports new epoch and total supply, which triggers rebase on the current-chain.
     *      The supply delta is calculated as the difference between the new total AMPL supply
     *      and the recorded AMPL total supply on the current-chain.
     *      After rebase, it notifies down-stream platforms by executing post-rebase callbacks
     *      on the rebase relayer.
     */
    function rebase(uint256 newAMPLEpoch, uint256 newTotalAMPLSupply) external onlyBridgeGateway {
        require(newAMPLEpoch > globalAmpleforthEpoch, "XCAmpleController: Epoch not new");

        int256 recordedTotalSupply = IXCAmple(xcAmple).totalSupply().toInt256Safe();
        IXCAmple(xcAmple).rebase(newAMPLEpoch, newTotalAMPLSupply);

        globalAmpleforthEpoch = newAMPLEpoch;
        int256 supplyDelta = newTotalAMPLSupply.toInt256Safe().sub(recordedTotalSupply);
        lastRebaseTimestampSec = now;
        emit GatewayRebase(msg.sender, globalAmpleforthEpoch, supplyDelta, lastRebaseTimestampSec);

        // executes callbacks only when the rebaseRelayer reference is set
        if (rebaseRelayer != address(0)) {
            require(IBatchTxExecutor(rebaseRelayer).executeAll());
        }
    }

    /**
     * @dev ZOS upgradable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract's state variables.
     */
    function initialize(address xcAmple_, uint256 globalAmpleforthEpoch_) public initializer {
        __Ownable_init();

        xcAmple = xcAmple_;
        globalAmpleforthEpoch = globalAmpleforthEpoch_;
    }
}
