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

/**
 * @title XCAmpleforth Policy
 * @dev This component controls the supply of the XCAmpleforth ERC20 tokens.
 *      It maintains a set of white-listed bridge gateway contracts which
 *      have the ability to `mint` and `burn` xc-amples. It also performs
 *      rebase on XCAmpleforth, based on updated AMPL supply reported through
 *      the bridge gateway.
 */
contract XCAmpleforthPolicy is OwnableUpgradeSafe {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using UInt256Lib for uint256;

    event RebaseReported(
        address indexed bridgeGateway,
        uint256 indexed epoch,
        uint256 totalSupply,
        uint256 timestampSec
    );

    event Mint(address indexed bridgeGateway, address indexed recipient, uint256 xcAmplAmount);

    event Burn(address indexed bridgeGateway, address indexed depositor, uint256 xcAmplAmount);

    event LogRebase(uint256 indexed epoch, int256 requestedSupplyAdjustment, uint256 timestampSec);

    // Reference to the cross-chain ample token contract.
    address public xcAmpl;

    // This module orchestrates the rebase execution and downstream notification.
    address public orchestrator;

    // More than this much time must pass before the rebase report from the bridge gateway
    // can be to execute rebase on the current-chain.
    uint256 public rebaseReportDelaySec;

    // The number of rebase cycles since inception of AMPL.
    uint256 public currentAMPLEpoch;

    // The timestamp when xc-ample rebase was executed.
    uint256 public rebaseTimestampSec;

    // The information about the most recent AMPL rebase reported through the bridge gateway
    uint256 public nextAMPLEpoch;
    uint256 public nextTotalAMPLSupply;
    uint256 public rebaseReportTimestampSec;

    // White-list of trusted bridge gateway contracts
    mapping(address => bool) public whitelistedBridgeGateways;

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "XCAmpleforthPolicy: Rebase caller not orchestrator");
        _;
    }

    modifier onlyBridgeGateway() {
        require(
            whitelistedBridgeGateways[msg.sender],
            "XCAmpleforthPolicy: Bridge gateway not whitelisted"
        );
        _;
    }

    /**
     * @notice Initiates a new rebase operation, provided the report delay time period has elapsed.
     * @dev The supply adjustment is inferred as the difference between
     *      the new totalSupply from the rebase report and the recorded total supply.
     */
    function rebase() external onlyOrchestrator {
        require(
            now.sub(rebaseReportTimestampSec) >= rebaseReportDelaySec,
            "XCAmpleforthPolicy: Report too fresh"
        );
        require(nextAMPLEpoch > currentAMPLEpoch, "XCAmpleforthPolicy: Epoch not new");

        currentAMPLEpoch = nextAMPLEpoch;
        int256 recordedTotalSupply = IXCAmpleforth(xcAmpl).totalSupply().toInt256Safe();
        int256 supplyDelta = nextTotalAMPLSupply.toInt256Safe().sub(recordedTotalSupply);
        IXCAmpleforth(xcAmpl).rebase(currentAMPLEpoch, nextTotalAMPLSupply);

        rebaseTimestampSec = now;

        emit LogRebase(currentAMPLEpoch, supplyDelta, rebaseTimestampSec);
    }

    /**
     * @notice Sets the reference to the orchestrator.
     * @param orchestrator_ The address of the orchestrator contract.
     */
    function setOrchestrator(address orchestrator_) external onlyOwner {
        orchestrator = orchestrator_;
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
     * @notice Sets the rebase report delay.
     * @param rebaseReportDelaySec_ The new rebase report delay.
     */
    function setRebaseReportDelay(uint256 rebaseReportDelaySec_) external onlyOwner {
        rebaseReportDelaySec = rebaseReportDelaySec_;
    }

    /**
     * @notice Upcoming rebase information reported by a bridge is updated in storage.
     * @param nextAMPLEpoch_ The new epoch.
     * @param totalSupply The new total supply.
     */
    function reportRebase(uint256 nextAMPLEpoch_, uint256 totalSupply) external onlyBridgeGateway {
        nextAMPLEpoch = nextAMPLEpoch_;
        nextTotalAMPLSupply = totalSupply;
        rebaseReportTimestampSec = now;

        emit RebaseReported(
            msg.sender,
            nextAMPLEpoch,
            nextTotalAMPLSupply,
            rebaseReportTimestampSec
        );
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
     * @dev ZOS upgradable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract's state variables.
     */
    function initialize(address xcAmpl_, uint256 currentAMPLEpoch_) public initializer {
        __Ownable_init();

        xcAmpl = xcAmpl_;

        currentAMPLEpoch = currentAMPLEpoch_;
        rebaseReportDelaySec = 15 minutes;
    }
}
