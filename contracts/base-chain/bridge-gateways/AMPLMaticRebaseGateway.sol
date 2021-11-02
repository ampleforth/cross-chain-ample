// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import {FxBaseRootTunnel} from "fx-portal/contracts/tunnel/FxBaseRootTunnel.sol";

import {IMaticBCRebaseGateway} from "../../_interfaces/bridge-gateways/IMaticGateway.sol";
import {IAmpleforth} from "uFragments/contracts/interfaces/IAmpleforth.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AMPLMaticRebaseGateway: AMPL-Matic Rebase Gateway Contract
 * @dev This contract is deployed on the base chain (Ethereum).
 *
 *      It's a pass-through contract between the Matic's bridge contracts and
 *      the Ampleforth policy.
 *
 */
contract AMPLMaticRebaseGateway is IMaticBCRebaseGateway, FxBaseRootTunnel {
    address public immutable ampl;
    address public immutable policy;

    /**
     * @dev Builds the payload and transmits rebase report to matic.
     */
    function reportRebase() external override {
        uint256 recordedGlobalAmpleforthEpoch = IAmpleforth(policy).epoch();
        uint256 recordedGlobalAMPLSupply = IERC20(ampl).totalSupply();

        emit XCRebaseReportOut(recordedGlobalAmpleforthEpoch, recordedGlobalAMPLSupply);

        _sendMessageToChild(abi.encode(recordedGlobalAmpleforthEpoch, recordedGlobalAMPLSupply));
    }

    /**
     * @dev Bridge callback. No-op as rebase report is one-way.
     */
    function _processMessageFromChild(bytes memory data) internal override {
        return;
    }

    constructor(
        address _checkpointManager,
        address _fxRoot,
        address ampl_,
        address policy_
    ) FxBaseRootTunnel(_checkpointManager, _fxRoot) {
        ampl = ampl_;
        policy = policy_;
    }
}
