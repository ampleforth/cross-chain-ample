// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {SafeMath} from "openzeppelin-contracts-3.4.1/contracts/math/SafeMath.sol";
import {Initializable} from "openzeppelin-contracts-3.4.1/contracts/proxy/Initializable.sol";
// solhint-disable-next-line max-line-length
import {GatewayMessageHandler} from "arb-bridge-peripherals/contracts/tokenbridge/libraries/gateway/GatewayMessageHandler.sol";
import {L1ArbitrumMessenger} from "arb-bridge-peripherals/contracts/tokenbridge/ethereum/L1ArbitrumMessenger.sol";

// solhint-disable-next-line max-line-length
import {IArbitrumBCRebaseGateway, IArbitrumBCTransferGateway, IArbitrumSCRebaseGateway, IArbitrumSCTransferGateway} from "../../_interfaces/bridge-gateways/IArbitrumGateway.sol";
import {IAmpleforth} from "ampleforth-contracts/contracts/interfaces/IAmpleforth.sol";
import {IERC20} from "openzeppelin-contracts-3.4.1/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts-3.4.1/contracts/token/ERC20/SafeERC20.sol";
import {ITokenVault} from "../../_interfaces/ITokenVault.sol";

/// @dev Abstract l2 gateway contarct implementation to define function selectors
abstract contract ArbitrumXCAmpleGateway is IArbitrumSCRebaseGateway, IArbitrumSCTransferGateway {
    function reportRebaseCommit(uint256 globalAmpleforthEpoch, uint256 globalAMPLSupply)
        external
        override
    {
        require(false, "ArbitrumXCAmpleGateway: NOT_IMPLEMENTED");
    }

    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external payable override {
        require(false, "ArbitrumXCAmpleGateway: NOT_IMPLEMENTED");
    }
}

/**
 * @title AMPLArbitrumGateway: AMPL-Arbitrum Gateway Contract
 * @dev This contract is deployed on the base chain (Ethereum).
 *
 *      It's a pass-through contract between the Arbitrum's bridge and
 *      the Ampleforth policy.
 *
 */
contract AMPLArbitrumGateway is
    IArbitrumBCRebaseGateway,
    IArbitrumBCTransferGateway,
    L1ArbitrumMessenger,
    Initializable
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //--------------------------------------------------------------------------
    // AMPL Base chain gateway attributes

    /// @dev Address of the AMPL ERC20 on the base chain.
    address public immutable ampl;

    /// @dev Address of the Ampleforth monetary policy on the base chain.
    address public immutable policy;

    /// @dev Address of the token vault which escrows funds on the base chain.
    address public immutable vault;

    //--------------------------------------------------------------------------
    // Arbitrum gateway attributes

    /// @dev Address of the arbitrum bridge inbox.
    address public inbox;

    /// @dev Address if the arbitrum bridge router.
    address public router;

    /// @dev Address of the counterpart gateway contract on the arbitrum chain
    ///      which "finalizes" cross chain transactions.
    address public counterpartGateway;

    /// @dev Address of XCAmple token on the satellite chain.
    address public xcAmple;

    //--------------------------------------------------------------------------
    // Modifiers

    // @dev Validate incoming transactions before "finalization".
    modifier onlyCounterpartGateway() {
        address bridge = address(super.getBridge(inbox));
        require(msg.sender == bridge, "AMPLArbitrumGateway: NOT_FROM_BRIDGE");

        address l2ToL1Sender = super.getL2ToL1Sender(inbox);
        require(
            l2ToL1Sender == counterpartGateway,
            "AMPLArbitrumGateway: ONLY_COUNTERPART_GATEWAY"
        );
        _;
    }

    //--------------------------------------------------------------------------
    // Constructor

    /**
     * @notice Instantiate the contract with references.
     * @param ampl_ Address of the AMPL ERC-20 on the Base Chain.
     * @param policy_ Address of the Ampleforth monetary policy on the Base Chain.
     * @param vault_ Address of the vault contract.
     */
    constructor(
        address ampl_,
        address policy_,
        address vault_
    ) public {
        ampl = ampl_;
        policy = policy_;
        vault = vault_;
    }

    /**
     * @notice Initialize contract with the addresses from the satellite chain (arbitrum).
     * @param inbox_ Address of the arbitrum bridge inbox on the base chain.
     * @param router_ Address of the arbitrum token transfer router on the base chain.
     * @param xcAmple_ Address of the XCAmple ERC-20 on the satellite chain.
     * @param counterpartGateway_ Address the counterpart gateway contract on the satellite chain.
     */
    function initialize(
        address inbox_,
        address router_,
        address xcAmple_,
        address counterpartGateway_
    ) public initializer {
        inbox = inbox_;
        router = router_;
        xcAmple = xcAmple_;
        counterpartGateway = counterpartGateway_;
    }

    //--------------------------------------------------------------------------
    // External methods

    /**
     * @notice Builds the payload and transmits rebase report to Arbitrum.
     * @param _maxSubmissionCost Amount of ETH allocated to pay for the base submission fee.
     * @param _maxGas Max gas deducted from user's L2 balance to cover L2 execution.
     * @param _gasPriceBid Gas price for L2 execution.
     * @return res abi encoded inbox sequence number.
     */
    function reportRebaseInit(
        uint256 _maxSubmissionCost,
        uint256 _maxGas,
        uint256 _gasPriceBid
    ) external payable override returns (bytes memory) {
        require(xcAmple != address(0), "AMPLArbitrumGateway: NOT_INITIALIZED");

        uint256 recordedGlobalAmpleforthEpoch = IAmpleforth(policy).epoch();
        uint256 recordedGlobalAMPLSupply = IERC20(ampl).totalSupply();

        emit XCRebaseReportOut(recordedGlobalAmpleforthEpoch, recordedGlobalAMPLSupply);

        uint256 seqNumber = sendTxToL2(
            inbox,
            counterpartGateway,
            tx.origin,
            msg.value,
            0,
            L2GasParams({
                _maxSubmissionCost: _maxSubmissionCost,
                _maxGas: _maxGas,
                _gasPriceBid: _gasPriceBid
            }),
            abi.encodeWithSelector(
                ArbitrumXCAmpleGateway.reportRebaseCommit.selector,
                recordedGlobalAmpleforthEpoch,
                recordedGlobalAMPLSupply
            )
        );

        emit RebaseReportInitiated(seqNumber);

        return abi.encode(seqNumber);
    }

    /**
     * @notice Deposit AMPL from Ethereum into Arbitrum.
     * @param _l1Token L1 address of the AMPL ERC20.
     * @param _to account to be credited with the tokens in the L2 (can be the user's L2 account or a contract).
     * @param _amount Token Amount.
     * @param _maxGas Max gas deducted from user's L2 balance to cover L2 execution.
     * @param _gasPriceBid Gas price for L2 execution.
     * @param _data encoded data from router and user.
     * @return res abi encoded inbox sequence number.
     */
    function outboundTransfer(
        address _l1Token,
        address _to,
        uint256 _amount,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external payable override returns (bytes memory) {
        require(msg.sender == router, "AMPLArbitrumGateway: NOT_FROM_ROUTER");

        require(_l1Token == ampl, "AMPLArbitrumGateway: ONLY_AMPL_ALLOWED");

        require(xcAmple != address(0), "AMPLArbitrumGateway: NOT_INITIALIZED");

        L2GasParams memory gasParams = L2GasParams({
            _maxSubmissionCost: 0,
            _maxGas: _maxGas,
            _gasPriceBid: _gasPriceBid
        });

        address from;
        (from, gasParams._maxSubmissionCost) = _parseDataFromRouterOnTransfer(_data);

        // Lock funds and log outbound transfer
        uint256 recordedGlobalAMPLSupply;
        {
            recordedGlobalAMPLSupply = IERC20(_l1Token).totalSupply();

            // NOTE: The usual xc-transfer flow involves the depositer approving the vault
            //       and initiating the transfer. However the arbitrum implementation expects
            //       the user to approve the gateway. We thus add this extra step to confirm
            //       to both interfaces.
            //       1) User approves the gateway
            //       2) Tokens transfer from user => gateway => vault
            IERC20(_l1Token).safeTransferFrom(from, address(this), _amount);
            IERC20(_l1Token).approve(vault, _amount);

            ITokenVault(vault).lock(_l1Token, address(this), _amount);

            emit XCTransferOut(from, address(0), _amount, recordedGlobalAMPLSupply);
        }

        // Execute cross-chain transfer
        return
            abi.encode(
                createOutboundTransfer(
                    _l1Token,
                    from,
                    _to,
                    _amount,
                    gasParams,
                    recordedGlobalAMPLSupply
                )
            );
    }

    /**
     * @notice Finalizes a withdrawal via Outbox message; callable only by L2Gateway.outboundTransfer
     * @param _l1Token L1 address of the AMPL ERC20.
     * @param _from initiator of withdrawal.
     * @param _to address the L2 withdrawal call set as the destination.
     * @param _amount Token amount being withdrawn.
     * @param _data encoded exitNum (Sequentially increasing exit counter determined by the L2Gateway)
     *        and recordedGlobalAMPLSupply from the source chain.
     */
    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external payable override onlyCounterpartGateway {
        require(_l1Token == ampl, "AMPLArbitrumGateway: ONLY_AMPL_ALLOWED");

        // Decode data from the bridge
        uint256 exitNum;
        uint256 globalAMPLSupply;
        (exitNum, globalAMPLSupply) = abi.decode(_data, (uint256, uint256));

        // Log inbound transfer and release funds
        uint256 unlockAmount;
        {
            uint256 recordedGlobalAMPLSupply = IERC20(ampl).totalSupply();

            emit XCTransferIn(address(0), _to, globalAMPLSupply, _amount, recordedGlobalAMPLSupply);

            unlockAmount = _amount.mul(recordedGlobalAMPLSupply).div(globalAMPLSupply);

            ITokenVault(vault).unlock(ampl, _to, unlockAmount);
        }

        emit WithdrawalFinalized(_l1Token, _from, _to, exitNum, unlockAmount);
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
        return _getOutboundCalldata(_l1Token, _from, _to, _amount, IERC20(ampl).totalSupply());
    }

    //--------------------------------------------------------------------------
    // Internal methods

    /// @dev Parses data packed by the router
    /// @return The depositor address and maxSubmissionCost
    function _parseDataFromRouterOnTransfer(bytes calldata _data)
        internal
        returns (address, uint256)
    {
        address from;
        bytes memory packedDataFromRouter;
        (from, packedDataFromRouter) = GatewayMessageHandler.parseFromRouterToGateway(_data);

        uint256 maxSubmissionCost;
        bytes memory extraData;
        (maxSubmissionCost, extraData) = abi.decode(packedDataFromRouter, (uint256, bytes));

        require(extraData.length == 0, "AMPLArbitrumGateway: EXTRA_DATA_DISABLED");

        return (from, maxSubmissionCost);
    }

    /// @dev Builds and executes the outbound transfer.
    /// @return seqNumber The bridge sequence number.
    function createOutboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        L2GasParams memory _gasParams,
        uint256 recordedGlobalAMPLSupply
    ) internal returns (uint256) {
        // packed data sent over the bridge
        bytes memory _outboundCallData = _getOutboundCalldata(
            _l1Token,
            _from,
            _to,
            _amount,
            recordedGlobalAMPLSupply
        );

        // Send data through the arbitrum bridge
        // Extra eth gets forwarded to the _from address on L2
        uint256 seqNumber = sendTxToL2(
            inbox,
            counterpartGateway,
            _from,
            msg.value, // we forward the L1 call value to the inbox
            0, // l2 call value 0 by default
            _gasParams,
            _outboundCallData
        );

        emit DepositInitiated(_l1Token, _from, _to, seqNumber, _amount);

        return seqNumber;
    }

    /// @dev Packs data for the outbound token transfer (with the current AMPL supply).
    /// @return The packed byte array.
    function _getOutboundCalldata(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        uint256 recordedGlobalAMPLSupply
    ) internal view returns (bytes memory) {
        bytes memory packedData = abi.encode(recordedGlobalAMPLSupply);

        bytes memory outboundCalldata = abi.encodeWithSelector(
            ArbitrumXCAmpleGateway.finalizeInboundTransfer.selector,
            _l1Token,
            _from,
            _to,
            _amount,
            packedData
        );

        return outboundCalldata;
    }
}
