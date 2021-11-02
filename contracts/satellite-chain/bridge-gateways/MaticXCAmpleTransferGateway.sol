// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {FxBaseChildTunnel} from "fx-portal/contracts/tunnel/FxBaseChildTunnel.sol";

import {IMaticTransferGateway} from "../../_interfaces/bridge-gateways/IMaticGateway.sol";
import {IXCAmpleController} from "../../_interfaces/IXCAmpleController.sol";
import {IXCAmpleControllerGateway} from "../../_interfaces/IXCAmpleControllerGateway.sol";
import {IXCAmple} from "../../_interfaces/IXCAmple.sol";

/**
 * @title MaticXCAmpleTransferGateway: Matic-XCAmple Transfer Gateway Contract
 * @dev This contract is deployed on the satellite chain (Matic).
 *
 *      It's a pass-through contract between the Matic's bridge contracts and
 *      the xc-ample contracts.
 *
 */
contract MaticXCAmpleTransferGateway is IMaticTransferGateway, FxBaseChildTunnel {
    using SafeMath for uint256;

    address public immutable xcAmple;
    address public immutable xcController;

    /**
     * @dev Burns specified amount from the {msg.sender}'s and notifies the bridge about the transfer.
     * @param recipientInTargetChain Address of the recipient wallet in the ethereum chain.
     * @param amount Amount of tokens to be burnt on matic.
     */
    function transfer(address recipientInTargetChain, uint256 amount) external override {
        uint256 recordedGlobalAMPLSupply = IXCAmple(xcAmple).globalAMPLSupply();

        IXCAmpleControllerGateway(xcController).burn(msg.sender, amount);

        emit XCTransferOut(msg.sender, recipientInTargetChain, amount, recordedGlobalAMPLSupply);

        _sendMessageToRoot(
            abi.encode(msg.sender, recipientInTargetChain, amount, recordedGlobalAMPLSupply)
        );
    }

    /**
     * @dev Bridge callback.
     */
    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory data
    ) internal override {
        address senderInSourceChain;
        address recipient;
        uint256 amount;
        uint256 globalAMPLSupply;
        (senderInSourceChain, recipient, amount, globalAMPLSupply) = abi.decode(
            data,
            (address, address, uint256, uint256)
        );

        _executeTransfer(senderInSourceChain, recipient, amount, globalAMPLSupply);
    }

    /**
     * @dev Calculates the amount of amples to be unlocked based on the share of total supply and
     *      transfers it to the recipient.
     * @param senderInSourceChain Address of the sender wallet in the matic chain.
     * @param recipient Address of the recipient wallet in ethereum.
     * @param amount Amount of tokens that were {burnt} on the matic.
     * @param globalAMPLSupply AMPL ERC-20 total supply at the time of transfer.
     */
    function _executeTransfer(
        address senderInSourceChain,
        address recipient,
        uint256 amount,
        uint256 globalAMPLSupply
    ) internal {
        uint256 recordedGlobalAMPLSupply = IXCAmple(xcAmple).globalAMPLSupply();

        uint256 mintAmount = amount.mul(recordedGlobalAMPLSupply).div(globalAMPLSupply);
        emit XCTransferIn(
            senderInSourceChain,
            recipient,
            globalAMPLSupply,
            mintAmount,
            recordedGlobalAMPLSupply
        );

        IXCAmpleControllerGateway(xcController).mint(recipient, mintAmount);
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
