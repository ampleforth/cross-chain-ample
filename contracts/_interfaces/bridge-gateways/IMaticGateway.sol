// SPDX-License-Identifier: GPL-3.0-or-later

import {IBCRebaseGatewayEvents, ISCRebaseGatewayEvents, ITransferGatewayEvents} from "./IGateway.sol";

interface IMaticBCRebaseGateway is IBCRebaseGatewayEvents {
    function reportRebase() external;
}

interface IMaticSCRebaseGateway is ISCRebaseGatewayEvents {}

interface IMaticTransferGateway is ITransferGatewayEvents {
    function transfer(address recipientInTargetChain, uint256 amount) external;
}
