// SPDX-License-Identifier: GPL-3.0-or-later

import {IBCRebaseGatewayEvents, ISCRebaseGatewayEvents, ITransferGatewayEvents} from "./IGateway.sol";

interface IChainBridgeBCRebaseGateway is IBCRebaseGatewayEvents {
    function validateRebaseReport(uint256 globalAmpleforthEpoch, uint256 globalAMPLSupply) external;
}

interface IChainBridgeSCRebaseGateway is ISCRebaseGatewayEvents {
    function reportRebase(uint256 globalAmpleforthEpoch, uint256 globalAMPLSupply) external;
}

interface IChainBridgeBCTransferGateway is ITransferGatewayEvents {
    function validateAndLock(
        address sender,
        address recipientInTargetChain,
        uint256 amount,
        uint256 globalAMPLSupply
    ) external;

    function unlock(
        address senderInSourceChain,
        address recipient,
        uint256 amount,
        uint256 globalAMPLSupply
    ) external;
}

interface IChainBridgeSCTransferGateway is ITransferGatewayEvents {
    function mint(
        address senderInSourceChain,
        address recipient,
        uint256 amount,
        uint256 globalAMPLSupply
    ) external;

    function validateAndBurn(
        address sender,
        address recipientInTargetChain,
        uint256 amount,
        uint256 globalAMPLSupply
    ) external;
}
