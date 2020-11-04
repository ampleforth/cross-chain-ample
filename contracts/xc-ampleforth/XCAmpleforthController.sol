pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "../lib/UInt256Lib.sol";

interface IXCAmpleforth {
    function totalSupply() external returns (uint256);

    function rebase(uint256 epoch, uint256 totalSupply_) external returns (uint256);

    function mint(address who, uint256 value) external;

    function burn(address who, uint256 value) external;
}

interface IXCOrchestrator {
    function executePostRebaseCallbacks() external returns (bool);
}

/**
 * @title XCAmpleforth Controller
 * @dev This component administers the XCAmpleforth ERC20 token contract.
 *      It maintains a set of white-listed bridge gateway contracts which
 *      have the ability to `mint` and `burn` xc-amples. It also performs
 *      rebase on XCAmpleforth, based on updated AMPL supply reported through
 *      the bridge gateway.
 */
contract XCAmpleforthController is OwnableUpgradeSafe {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using UInt256Lib for uint256;

    event Mint(address indexed bridgeGateway, address indexed recipient, uint256 xcAmplAmount);

    event Burn(address indexed bridgeGateway, address indexed depositor, uint256 xcAmplAmount);

    event LogRebase(uint256 indexed epoch, int256 requestedSupplyAdjustment, uint256 timestampSec);

    // Reference to the cross-chain ample token contract.
    address public xcAmpl;

    // This module orchestrates the rebase execution and downstream notification.
    address public orchestrator;

    // The number of rebase cycles since inception of AMPL.
    uint256 public currentAMPLEpoch;

    // The timestamp when xc-ample rebase was executed.
    uint256 public rebaseTimestampSec;

    // White-list of trusted bridge gateway contracts
    mapping(address => bool) public whitelistedBridgeGateways;

    modifier onlyBridgeGateway() {
        require(
            whitelistedBridgeGateways[msg.sender],
            "XCAmpleforthController: Bridge gateway not whitelisted"
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
     * @notice Sets the reference to the orchestrator.
     * @param orchestrator_ The address of the orchestrator contract.
     */
    function setOrchestrator(address orchestrator_) external onlyOwner {
        orchestrator = orchestrator_;
    }

    /**
     * @notice Mint xc-amples to a recipient.
     * @dev Bridge locks AMPLs on the master-chain and mints xc-amples on the current-chain.
     *
     * @param recipient The address of the recipient.
     * @param xcAmplAmount The amount of xc-amples to be mint on the current-chain.
     */
    function mint(address recipient, uint256 xcAmplAmount) external onlyBridgeGateway {
        IXCAmpleforth(xcAmpl).mint(recipient, xcAmplAmount);
        emit Mint(msg.sender, recipient, xcAmplAmount);
    }

    /**
     * @notice Burn xc-amples from depositor.
     * @dev Bridge burns xc-amples on the current-chain and unlocks AMPLs on the master-chain.
     *
     * @param depositor The address of the depositor.
     * @param xcAmplAmount The amount of xc-amples to be burnt on the current-chain.
     */
    function burn(address depositor, uint256 xcAmplAmount) external onlyBridgeGateway {
        IXCAmpleforth(xcAmpl).burn(depositor, xcAmplAmount);
        emit Burn(msg.sender, depositor, xcAmplAmount);
    }

    /**
     * @notice Initiate a new rebase operation.
     * @param newAMPLEpoch The new epoch after rebase on the master-chain.
     * @param newTotalAMPLSupply The new AMPL total supply after rebase on the master-chain.
     * @dev Bridge reports new epoch and total supply, which triggers rebase on the current-chain.
     *      The supply adjustment is inferred as the difference between the new total AMPL supply
     *      and the recorded AMPL total supply on the current-chain.
     *      After rebase, it notifies down-stream platforms by executing post-rebase callbacks
     *      on the orchestrator.
     */
    function rebase(uint256 newAMPLEpoch, uint256 newTotalAMPLSupply) external onlyBridgeGateway {
        require(newAMPLEpoch > currentAMPLEpoch, "XCAmpleforthController: Epoch not new");

        int256 recordedTotalSupply = IXCAmpleforth(xcAmpl).totalSupply().toInt256Safe();
        IXCAmpleforth(xcAmpl).rebase(newAMPLEpoch, newTotalAMPLSupply);

        currentAMPLEpoch = newAMPLEpoch;
        int256 supplyDelta = newTotalAMPLSupply.toInt256Safe().sub(recordedTotalSupply);
        rebaseTimestampSec = now;
        emit LogRebase(currentAMPLEpoch, supplyDelta, rebaseTimestampSec);

        // executes callbacks only when the orchestrator reference is set
        if (orchestrator != address(0)) {
            require(IXCOrchestrator(orchestrator).executePostRebaseCallbacks());
        }
    }

    /**
     * @dev ZOS upgradable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract's state variables.
     */
    function initialize(address xcAmpl_, uint256 currentAMPLEpoch_) public initializer {
        __Ownable_init();

        xcAmpl = xcAmpl_;
        currentAMPLEpoch = currentAMPLEpoch_;
    }
}
