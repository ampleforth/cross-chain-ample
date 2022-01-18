// SPDX-License-Identifier: GPL-3.0-or-later
import {IBCRebaseGatewayEvents, ISCRebaseGatewayEvents, ITransferGatewayEvents} from "./IGateway.sol";
import {ITokenGateway} from "arb-bridge-peripherals/contracts/tokenbridge/libraries/gateway/ITokenGateway.sol";

// Arbitrum chains expect the cross chain transaction to "pre-pay" in eth
// for execution on the other chain
// https://developer.offchainlabs.com/docs/l1_l2_messages

interface IArbitrumBCRebaseGateway is IBCRebaseGatewayEvents {
    event RebaseReportInitiated(uint256 indexed _sequenceNumber);

    function reportRebaseInit(
        uint256 _maxSubmissionCost,
        uint256 _maxGas,
        uint256 _gasPriceBid
    ) external payable returns (bytes memory);
}

interface IArbitrumSCRebaseGateway is ISCRebaseGatewayEvents {
    event RebaseReportFinalized(uint256 indexed _exitNum);

    function reportRebaseCommit(uint256 globalAmpleforthEpoch, uint256 globalAMPLSupply) external;
}

interface IArbitrumTransferGateway is ITransferGatewayEvents, ITokenGateway {
    function getOutboundCalldata(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes memory _data
    ) external view returns (bytes memory);
}

interface IArbitrumBCTransferGateway is IArbitrumTransferGateway {
    event DepositInitiated(
        address l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _sequenceNumber,
        uint256 _amount
    );

    event WithdrawalFinalized(
        address l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _exitNum,
        uint256 _amount
    );
}

interface IArbitrumSCTransferGateway is IArbitrumTransferGateway {
    event DepositFinalized(
        address indexed l1Token,
        address indexed _from,
        address indexed _to,
        uint256 _amount
    );

    event WithdrawalInitiated(
        address l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _l2ToL1Id,
        uint256 _exitNum,
        uint256 _amount
    );
}
