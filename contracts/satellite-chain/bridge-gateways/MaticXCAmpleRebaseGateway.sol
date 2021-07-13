// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import {FxBaseChildTunnel} from "fx-portal/contracts/tunnel/FxBaseChildTunnel.sol";
import {Layer2RebaseGateway} from "../../base-bridge-gateways/Layer2RebaseGateway.sol";

import {IXCAmpleController} from "../../_interfaces/IXCAmpleController.sol";
import {IXCAmpleControllerGateway} from "../../_interfaces/IXCAmpleControllerGateway.sol";
import {IXCAmple} from "../../_interfaces/IXCAmple.sol";

/**
 * @title MaticXCAmpleRebaseGateway: Matic-XCAmple Rebase Gateway Contract
 * @dev This contract is deployed on the satellite chain (Matic).
 *
 *      It's a pass-through contract between the Matic's bridge contracts and
 *      the xc-ample contracts.
 *
 */
contract MaticXCAmpleRebaseGateway is Layer2RebaseGateway, FxBaseChildTunnel {
    address public immutable xcAmple;
    address public immutable xcController;

    /**
     * @dev Forwards the most recent rebase information from the matic bridge to the xc-ample controller.
     *      "globalAmpleforthEpoch": Ampleforth monetary policy epoch from ethereum.
     *      "globalAMPLSupply": AMPL ERC-20 total supply from ethereum.
     */
    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory data
    ) internal override validateSender(sender) {
        uint256 globalAmpleforthEpoch;
        uint256 globalAMPLSupply;
        (globalAmpleforthEpoch, globalAMPLSupply) = abi.decode(data, (uint256, uint256));

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

    constructor(
        address _fxChild,
        address xcAmple_,
        address xcController_
    ) FxBaseChildTunnel(_fxChild) {
        xcAmple = xcAmple_;
        xcController = xcController_;
    }
}
