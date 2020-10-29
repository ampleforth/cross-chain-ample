pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../bridge/IBridgeAmplforthGateway.sol";

/**
 * @title AmplCBTransferGateway: Ampl-ChainBridge Rebase Gateway
 * @dev This contract is deployed on the 'master' chain (Ethereum).
 *      It's a pass-through contract between the ChainBridge handler contract and
 *      the AMPL vault.
 *
 *      When the user transfers AMPLs from the master chain to the other chain
 *      `validateAndLock` locks ampls in the vault and validates the total supply
 *      reported is consistent with the current on-chain value.
 *
 *      When the user transfers AMPLs from the other chain back to the master chain
 *      the tokens are unlocked from the vault. The amount of tokens to be unlocked
 *      is calculated based on the total supply recored at the time of transfer
 *      and the total supply at the time of unlock.
 *
 *      NOTE: This contract is NOT upgradeable.
 */
contract AmplCBTransferGateway is IBridgeAmplforthTransferGateway, Ownable {
    using SafeMath for uint256;

    address public ampl;
    address public vault;

    /**
     * @notice Validates the data from the handler and transfers specified amount from
     *         the depositor's wallet and locks it in the vault contract.
     */
    function validateAndLock(
        address depositor,
        address recipient,
        uint256 recordedAmount,
        uint256 recordedTotalAMPLSupply
    ) public onlyOwner returns (bool) {
        require(
            recordedTotalAMPLSupply == IAmpleforth(ampl).totalSupply(),
            "AmplCBTransferGateway: recorded total supply not consistent"
        );

        ITokenVault(vault).lock(depositor, recordedAmount);

        emit XCTransferOut(depositor, recipient, recordedAmount, recordedTotalAMPLSupply);

        return true;
    }

    /**
     * @notice Infers the correct amount of AMPLs based on the gon amount in the data from the handler
     *         and transfers it to the recipient.
     */
    function unlock(
        address depositor,
        address recipient,
        uint256 recordedAmount,
        uint256 recordedTotalAMPLSupply
    ) public onlyOwner returns (bool) {
        uint256 currentTotalAMPLSupply = IAmpleforth(ampl).totalSupply();
        uint256 inferredAmount = recordedAmount.mul(currentTotalAMPLSupply).div(
            recordedTotalAMPLSupply
        );
        ITokenVault(vault).unlock(recipient, inferredAmount);

        emit XCTransferIn(
            depositor,
            recipient,
            recordedAmount,
            recordedTotalAMPLSupply,
            inferredAmount,
            currentTotalAMPLSupply
        );

        return true;
    }

    constructor(
        address bridgeHandler,
        address ampl_,
        address vault_
    ) public {
        ampl = ampl_;
        vault = vault_;

        transferOwnership(bridgeHandler);
    }
}
