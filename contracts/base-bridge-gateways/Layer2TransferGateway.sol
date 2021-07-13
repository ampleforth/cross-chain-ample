// SPDX-License-Identifier: GPL-3.0-or-later

import {ITransferGatewayEvents} from "../_interfaces/bridge-gateways/ITransferGatewayEvents.sol";

contract Layer2TransferGateway is ITransferGatewayEvents {
    // overridden on the satellite chain gateway (tron, acala, near)
    function transfer(address recipientInTargetChain, uint256 amount) external virtual {
        require(false, "Gateway function NOT_IMPLEMENTED");
    }
}
