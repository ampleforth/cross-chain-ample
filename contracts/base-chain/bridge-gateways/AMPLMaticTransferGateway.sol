// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {FxBaseRootTunnel} from "fx-portal/contracts/tunnel/FxBaseRootTunnel.sol";
import {Layer2TransferGateway} from "../../base-bridge-gateways/Layer2TransferGateway.sol";

import {ITokenVault} from "../../_interfaces/ITokenVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AMPLMaticTransferGateway: AMPL-Matic Transfer Gateway Contract
 * @dev This contract is deployed on the base chain (Ethereum).
 *
 *      It's a pass-through contract between the Matic's bridge contracts and
 *      the and the Token vault.
 *
 */
contract AMPLMaticTransferGateway is Layer2TransferGateway, FxBaseRootTunnel {
    using SafeMath for uint256;

    address public immutable ampl;
    address public immutable vault;

    /**
     * @dev Calculates the amount of amples to be unlocked based on the share of total supply and
     *      transfers it to the recipient.
     *      "senderAddressInSourceChain": Address of the sender wallet in the matic chain.
     *      "recipient": Address of the recipient wallet in ethereum.
     *      "amount": Amount of tokens that were {burnt} on the matic.
     *      "globalAMPLSupply": AMPL ERC-20 total supply at the time of transfer.
     */
    function _processMessageFromChild(bytes memory data) internal override {
        address senderInSourceChain;
        address recipient;
        uint256 amount;
        uint256 globalAMPLSupply;
        (senderInSourceChain, recipient, amount, globalAMPLSupply) = abi.decode(
            data,
            (address, address, uint256, uint256)
        );

        uint256 recordedGlobalAMPLSupply = IERC20(ampl).totalSupply();

        emit XCTransferIn(
            senderInSourceChain,
            recipient,
            amount,
            globalAMPLSupply,
            recordedGlobalAMPLSupply
        );

        uint256 unlockAmount = amount.mul(recordedGlobalAMPLSupply).div(globalAMPLSupply);
        ITokenVault(vault).unlock(ampl, recipient, unlockAmount);
    }

    /**
     * @dev Transfers specified amount from the {msg.sender}'s wallet and locks it in the vault contract,
     *      notifies the bridge about the transfer.
     * @param recipientInTargetChain Address of the recipient wallet in the matic chain.
     * @param amount Amount of tokens to be locked on ethereum.
     */
    function transfer(address recipientInTargetChain, uint256 amount) external override {
        uint256 recordedGlobalAMPLSupply = IERC20(ampl).totalSupply();

        ITokenVault(vault).lock(ampl, msg.sender, amount);

        emit XCTransferOut(msg.sender, recipientInTargetChain, amount, recordedGlobalAMPLSupply);

        _sendMessageToChild(
            abi.encode(msg.sender, recipientInTargetChain, amount, recordedGlobalAMPLSupply)
        );
    }

    constructor(
        address _checkpointManager,
        address _fxRoot,
        address ampl_,
        address vault_
    ) FxBaseRootTunnel(_checkpointManager, _fxRoot) {
        ampl = ampl_;
        vault = vault_;
    }
}
