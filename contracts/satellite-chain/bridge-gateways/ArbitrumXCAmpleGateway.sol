// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {GatewayMessageHandler} from "arb-bridge-peripherals/contracts/tokenbridge/libraries/gateway/GatewayMessageHandler.sol";
import {L2ArbitrumMessenger} from "arb-bridge-peripherals/contracts/tokenbridge/arbitrum/L2ArbitrumMessenger.sol";
import {AddressAliasHelper} from "arb-bridge-eth/contracts/libraries/AddressAliasHelper.sol";

import {IArbitrumBCRebaseGateway, IArbitrumBCTransferGateway, IArbitrumSCRebaseGateway, IArbitrumSCTransferGateway} from "../../_interfaces/bridge-gateways/IArbitrumGateway.sol";
import {IXCAmpleController} from "../../_interfaces/IXCAmpleController.sol";
import {IXCAmpleControllerGateway} from "../../_interfaces/IXCAmpleControllerGateway.sol";
import {IXCAmple} from "../../_interfaces/IXCAmple.sol";

/// @dev Abstract l1 gateway contarct implementation to define function selector
abstract contract AMPLArbitrumGateway is IArbitrumBCRebaseGateway, IArbitrumBCTransferGateway {
    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external payable override {
        require(false, "AMPLArbitrumGateway: NOT_IMPLEMENTED");
    }
}

/**
 * @title ArbitrumXCAmpleGateway: Arbitrum-XCAmple Gateway Contract
 * @dev This contract is deployed on the l2 chain (Arbitrum).
 *
 *      It's a pass-through contract between the Arbitrum's bridge and
 *      the the XCAmple contracts.
 *
 */
contract ArbitrumXCAmpleGateway is
    IArbitrumSCRebaseGateway,
    IArbitrumSCTransferGateway,
    L2ArbitrumMessenger,
    Initializable
{
    using SafeMath for uint256;

    //--------------------------------------------------------------------------
    // XCAmple Satelltie chain gateway attributes

    /// @dev Address of XCAmple token on the satellite chain.
    address public immutable xcAmple;

    /// @dev Address of XCAmple Controller on the satellite chain.
    address public immutable xcController;

    //--------------------------------------------------------------------------
    // AMPL Base chain gateway attributes

    /// @dev Address of the AMPL ERC20 on the base chain.
    address public ampl;

    //--------------------------------------------------------------------------
    // Arbitrum gateway attributes

    /// @dev Address if the arbitrum bridge router.
    address public router;

    /// @dev Address of the counterpart gateway contract on the base chain
    ///      which "finalizes" cross chain transactions.
    address public counterpartGateway;

    /// @dev Cross chain deposit nonce.
    uint256 public exitNum;

    //--------------------------------------------------------------------------
    // Modifiers

    // @dev Validate incoming transactions before "finalization".
    modifier onlyCounterpartGateway() {
        require(
            msg.sender == counterpartGateway ||
                AddressAliasHelper.undoL1ToL2Alias(msg.sender) == counterpartGateway,
            "ArbitrumXCAmpleGateway: ONLY_COUNTERPART_GATEWAY"
        );
        _;
    }

    //--------------------------------------------------------------------------
    // Constructor

    /**
     * @notice Instantiate the contract with references.
     * @param xcAmple_ Address of the XCAmple ERC-20 on the satellite chain.
     * @param xcController_ Address of the XCAmple Controller on the satellite chain.
     */
    constructor(address xcAmple_, address xcController_) public {
        xcAmple = xcAmple_;
        xcController = xcController_;
    }

    /**
     * @notice Initialize contract with the addresses from the base chain.
     * @param router_ Address of the arbitrum token transfer router on the satellite chain.
     * @param ampl_ Address of the AMPL ERC-20 on the base chain.
     * @param counterpartGateway_ Address the counterpart gateway contract on the base chain.
     */
    function initialize(
        address router_,
        address ampl_,
        address counterpartGateway_
    ) public initializer {
        ampl = ampl_;
        router = router_;
        counterpartGateway = counterpartGateway_;
    }

    //--------------------------------------------------------------------------
    // External methods

    /*
     * @notice Forwards the most recent rebase information from the bridge to the XCAmple controller.
     * @param globalAmpleforthEpoch Ampleforth monetary policy epoch from ethereum.
     * @param globalAMPLSupply AMPL ERC-20 total supply from ethereum.
     */
    function reportRebaseCommit(uint256 globalAmpleforthEpoch, uint256 globalAMPLSupply)
        external
        override
        onlyCounterpartGateway
    {
        uint256 recordedGlobalAmpleforthEpoch = IXCAmpleController(xcController)
            .globalAmpleforthEpoch();

        uint256 recordedGlobalAMPLSupply = IXCAmple(xcAmple).globalAMPLSupply();

        emit XCRebaseReportIn(
            globalAmpleforthEpoch,
            globalAMPLSupply,
            recordedGlobalAmpleforthEpoch,
            recordedGlobalAMPLSupply
        );

        IXCAmpleControllerGateway(xcController).reportRebase(
            globalAmpleforthEpoch,
            globalAMPLSupply
        );
    }

    /**
     * @notice Initiates a token withdrawal from Arbitrum to Ethereum.
     * @param _l1Token l1 address of token.
     * @param _to destination address.
     * @param _amount amount of tokens withdrawn.
     * @return res encoded unique identifier for withdrawal.
     */
    function outboundTransfer(
        address _l1Token,
        address _to,
        uint256 _amount,
        uint256, /* _maxGas */
        uint256, /* _gasPriceBid */
        bytes calldata _data
    ) public payable virtual override returns (bytes memory res) {
        require(msg.sender == router, "ArbitrumXCAmpleGateway: NOT_FROM_ROUTER");

        // the function is marked as payable to conform to the inheritance setup
        // this particular code path shouldn't have a msg.value > 0
        require(msg.value == 0, "ArbitrumXCAmpleGateway: NO_VALUE");

        require(_l1Token == ampl, "ArbitrumXCAmpleGateway: ONLY_AMPL_ALLOWED");

        require(ampl != address(0), "AMPLArbitrumGateway: NOT_INITIALIZED");

        address from = _parseDataFromRouterOnTransfer(_data);

        // Burn funds and log outbound transfer
        uint256 recordedGlobalAMPLSupply;
        {
            recordedGlobalAMPLSupply = IXCAmple(xcAmple).globalAMPLSupply();

            IXCAmpleControllerGateway(xcController).burn(from, _amount);

            emit XCTransferOut(from, address(0), _amount, recordedGlobalAMPLSupply);
        }

        // Execute cross-chain transfer
        return
            abi.encode(
                createOutboundTransfer(_l1Token, from, _to, _amount, recordedGlobalAMPLSupply)
            );
    }

    /**
     * @notice Mint on L2 upon L1 deposit.
     * @dev Callable only by the L1ERC20Gateway.outboundTransfer method.
     * @param _l1Token L1 address of ERC20.
     * @param _from account that initiated the deposit in the L1.
     * @param _to account to be credited with the tokens in the L2 (can be the user's L2 account or a contract).
     * @param _amount token amount to be minted to the user.
     * @param _data encoded symbol/name/decimal data for deploy, in addition to any additional callhook data.
     */
    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external payable override onlyCounterpartGateway {
        require(_l1Token == ampl, "ArbitrumXCAmpleGateway: ONLY_AMPL_ALLOWED");

        // Decode data from the bridge
        uint256 globalAMPLSupply = abi.decode(_data, (uint256));

        // Log inbound transfer and mint funds
        uint256 mintAmount;
        {
            uint256 recordedGlobalAMPLSupply = IXCAmple(xcAmple).globalAMPLSupply();

            mintAmount = _amount.mul(recordedGlobalAMPLSupply).div(globalAMPLSupply);
            emit XCTransferIn(
                address(0),
                _to,
                globalAMPLSupply,
                mintAmount,
                recordedGlobalAMPLSupply
            );

            IXCAmpleControllerGateway(xcController).mint(_to, mintAmount);
        }

        emit DepositFinalized(_l1Token, _from, _to, mintAmount);
    }

    //--------------------------------------------------------------------------
    // View methods

    /// @return The L2 AMPL token address.
    function calculateL2TokenAddress(address token) public view override returns (address) {
        if (token != ampl) {
            return address(0);
        }
        return xcAmple;
    }

    /// @return The encoded outbound call data with the current globalAMPLSupply.
    function getOutboundCalldata(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes memory _data
    ) external view override returns (bytes memory) {
        return
            _getOutboundCalldata(
                _l1Token,
                _from,
                _to,
                _amount,
                exitNum,
                IXCAmple(xcAmple).globalAMPLSupply()
            );
    }

    //--------------------------------------------------------------------------
    // Internal methods

    /// @dev Parses data packed by the router
    /// @return The depositor address
    function _parseDataFromRouterOnTransfer(bytes calldata _data) internal returns (address) {
        address from;
        bytes memory packedDataFromRouter;
        (from, packedDataFromRouter) = GatewayMessageHandler.parseFromRouterToGateway(_data);

        require(packedDataFromRouter.length == 0, "ArbitrumXCAmpleGateway: EXTRA_DATA_DISABLED");

        return from;
    }

    /// @dev Builds and executes the outbound transfer.
    /// @return seqNumber The bridge sequence number.
    function createOutboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        uint256 recordedGlobalAMPLSupply
    ) internal returns (uint256) {
        // packed data sent over the bridge
        bytes memory _outboundCallData = _getOutboundCalldata(
            _l1Token,
            _from,
            _to,
            _amount,
            exitNum,
            recordedGlobalAMPLSupply
        );

        uint256 id = sendTxToL1(0, _from, counterpartGateway, _outboundCallData);

        emit WithdrawalInitiated(_l1Token, _from, _to, id, exitNum, _amount);

        exitNum++;

        return id;
    }

    function _getOutboundCalldata(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        uint256 exitNum,
        uint256 recordedGlobalAMPLSupply
    ) internal view returns (bytes memory) {
        bytes memory packedData = abi.encode(exitNum, recordedGlobalAMPLSupply);

        bytes memory outboundCalldata = abi.encodeWithSelector(
            AMPLArbitrumGateway.finalizeInboundTransfer.selector,
            _l1Token,
            _from,
            _to,
            _amount,
            packedData
        );

        return outboundCalldata;
    }
}
