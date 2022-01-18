// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {InboxMock} from "arb-bridge-peripherals/contracts/tokenbridge/test/InboxMock.sol";
import {L1ArbitrumMessenger} from "arb-bridge-peripherals/contracts/tokenbridge/ethereum/L1ArbitrumMessenger.sol";
import {L2ArbitrumMessenger} from "arb-bridge-peripherals/contracts/tokenbridge/arbitrum/L2ArbitrumMessenger.sol";
import {L1ArbitrumTestMessenger} from "arb-bridge-peripherals/contracts/tokenbridge/test/GatewayTest.sol";
import {L2ArbitrumTestMessenger} from "arb-bridge-peripherals/contracts/tokenbridge/test/GatewayTest.sol";
import {IBridge} from "arb-bridge-peripherals/contracts/tokenbridge/test/GatewayTest.sol";
import {AMPLArbitrumGateway} from "../base-chain/bridge-gateways/AMPLArbitrumGateway.sol";
import {ArbitrumXCAmpleGateway} from "../satellite-chain/bridge-gateways/ArbitrumXCAmpleGateway.sol";

contract MockArbitrumInbox is InboxMock {}

// Mocking sendTxToL2
// https://shorturl.at/dgABO
contract MockAMPLArbitrumGateway is L1ArbitrumTestMessenger, AMPLArbitrumGateway {
    constructor(
        address ampl_,
        address policy_,
        address vault_
    ) public AMPLArbitrumGateway(ampl_, policy_, vault_) {}

    function sendTxToL2(
        address _inbox,
        address _to,
        address _user,
        uint256 _l1CallValue,
        uint256 _l2CallValue,
        uint256 _maxSubmissionCost,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes memory _data
    ) internal virtual override(L1ArbitrumMessenger, L1ArbitrumTestMessenger) returns (uint256) {
        return
            L1ArbitrumTestMessenger.sendTxToL2(
                _inbox,
                _to,
                _user,
                _l1CallValue,
                _l2CallValue,
                _maxSubmissionCost,
                _maxGas,
                _gasPriceBid,
                _data
            );
    }

    function getL2ToL1Sender(address _inbox)
        internal
        view
        virtual
        override(L1ArbitrumMessenger, L1ArbitrumTestMessenger)
        returns (address)
    {
        return L1ArbitrumTestMessenger.getL2ToL1Sender(_inbox);
    }

    function getBridge(address _inbox)
        internal
        view
        virtual
        override(L1ArbitrumMessenger, L1ArbitrumTestMessenger)
        returns (IBridge)
    {
        return L1ArbitrumTestMessenger.getBridge(_inbox);
    }
}

contract MockArbitrumXCAmpleGateway is L2ArbitrumTestMessenger, ArbitrumXCAmpleGateway {
    constructor(address xcAmple_, address xcController_)
        public
        ArbitrumXCAmpleGateway(xcAmple_, xcController_)
    {}

    function sendTxToL1(
        uint256 _l1CallValue,
        address _from,
        address _to,
        bytes memory _data
    ) internal virtual override(L2ArbitrumMessenger, L2ArbitrumTestMessenger) returns (uint256) {
        return L2ArbitrumTestMessenger.sendTxToL1(_l1CallValue, _from, _to, _data);
    }
}
