// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./UInt256Lib.sol";
import "../../_interfaces/IXCAmple.sol";
import "../../_interfaces/IBatchTxExecutor.sol";

/**
 * @title XC(Cross-Chain)Ample Controller
 * @dev This component administers the XCAmple ERC20 token contract.
 *      It maintains a set of white-listed bridge gateway contracts which
 *      have the ability to `mint` and `burn` xcAmples. It also performs
 *      rebase on XCAmple, based on updated AMPL supply reported through
 *      the bridge gateway.
 */
contract XCAmpleController is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SignedSafeMathUpgradeable for int256;
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

    event GatewayRebaseReported(
        address indexed bridgeGateway,
        uint256 indexed epoch,
        uint256 globalAMPLSupply,
        uint256 timestampSec
    );

    event LogRebase(uint256 indexed epoch, int256 requestedSupplyAdjustment, uint256 timestampSec);

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

    // The information about the most recent AMPL rebase reported through the bridge gateway
    uint256 public nextGlobalAmpleforthEpoch;
    uint256 public nextGlobalAMPLSupply;

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
     * @dev Bridge mints xcAmples on this satellite chain.
     *
     * @param recipient The address of the recipient.
     * @param xcAmpleAmount The amount of xcAmples to be mint on this chain.
     */
    function mint(address recipient, uint256 xcAmpleAmount) external onlyBridgeGateway {
        IXCAmple(xcAmple).mint(recipient, xcAmpleAmount);
        emit GatewayMint(msg.sender, recipient, xcAmpleAmount);
    }

    /**
     * @notice Burn xcAmples from depositor.
     * @dev Bridge burns xcAmples on this satellite chain.
     *
     * @param depositor The address of the depositor.
     * @param xcAmpleAmount The amount of xcAmples to be burnt on this chain.
     */
    function burn(address depositor, uint256 xcAmpleAmount) external onlyBridgeGateway {
        IXCAmple(xcAmple).burn(depositor, xcAmpleAmount);
        emit GatewayBurn(msg.sender, depositor, xcAmpleAmount);
    }

    /**
     * @notice Upcoming rebase information reported by a bridge gateway and updated in storage.
     * @param nextGlobalAmpleforthEpoch_ The new epoch after rebase on the base chain.
     * @param nextGlobalAMPLSupply_ The new globalAMPLSupply after rebase on the base chain.
     */
    function reportRebase(uint256 nextGlobalAmpleforthEpoch_, uint256 nextGlobalAMPLSupply_)
        external
        onlyBridgeGateway
    {
        nextGlobalAmpleforthEpoch = nextGlobalAmpleforthEpoch_;
        nextGlobalAMPLSupply = nextGlobalAMPLSupply_;

        emit GatewayRebaseReported(
            msg.sender,
            nextGlobalAmpleforthEpoch,
            nextGlobalAMPLSupply,
            now
        );
    }

    /**
     * @notice Initiate a new rebase operation.
     * @dev Once the Bridge gateway reports new epoch and total supply Rebase can be triggered on this satellite chain.
     *      The supply delta is calculated as the difference between the new reported globalAMPLSupply
     *      and the recordedGlobalAMPLSupply on this chain.
     *      After rebase, it notifies down-stream platforms by executing post-rebase callbacks
     *      on the rebase relayer.
     */
    function rebase() public {
        // recently reported epoch needs to be more than current globalEpoch in storage
        require(
            nextGlobalAmpleforthEpoch > globalAmpleforthEpoch,
            "XCAmpleController: Epoch not new"
        );

        // the globalAMPLSupply recorded on this chain
        int256 recordedGlobalAMPLSupply = IXCAmple(xcAmple).globalAMPLSupply().toInt256Safe();

        // execute rebase on this chain
        IXCAmple(xcAmple).rebase(nextGlobalAmpleforthEpoch, nextGlobalAMPLSupply);

        // calculate supply delta
        int256 supplyDelta = nextGlobalAMPLSupply.toInt256Safe().sub(recordedGlobalAMPLSupply);

        // update state variables on this chain
        globalAmpleforthEpoch = nextGlobalAmpleforthEpoch;
        lastRebaseTimestampSec = now;

        // log rebase event
        emit LogRebase(globalAmpleforthEpoch, supplyDelta, lastRebaseTimestampSec);

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
