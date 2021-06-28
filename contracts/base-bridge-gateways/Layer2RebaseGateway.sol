// SPDX-License-Identifier: GPL-3.0-or-later

import {IRebaseGatewayEvents} from "../_interfaces/bridge-gateways/IRebaseGatewayEvents.sol";

contract Layer2RebaseGateway is IRebaseGatewayEvents {
    // overridden on the base chain gateway (ethereum)
    function reportRebase() external virtual {
        require(false, "Gateway function NOT_IMPLEMENTED");
    }
}
