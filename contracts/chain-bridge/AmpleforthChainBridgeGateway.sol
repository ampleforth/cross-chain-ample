pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../bridge/IBridgeAmplforthGateway.sol";

/**
 * @title AmpleforthChainBridgeGateway
 * @dev This contract is deployed on the 'master' chain (Ethereum).
 *      It's a intermediate contract between the ChainBridge Generic handler contract and
 *      the Ampl vault.
 *
 *      It validates data from the handler contract.
 *      In case of unlocks, it also handles gons to ampl conversion.
 *
 *      NOTE: This contract is NOT upgradeable.
 */
contract AmpleforthChainBridgeGateway is IBridgeAmplforthGateway, Ownable {
    using SafeMath for uint256;

    address public ampl;
    address public policy;
    address public vault;

    /**
     * @notice Validates if the data from the handler is consistent with the current on-chain value.
     */
    function validateRebaseReport(uint256 recordedAMPLEpoch, uint256 recordedTotalAMPLSupply)
        public
        onlyOwner
        returns (bool)
    {
        require(
            recordedAMPLEpoch == IAmpleforthPolicy(policy).epoch(),
            "AmpleforthChainBridgeGateway: recorded epoch not consistent"
        );
        require(
            recordedTotalAMPLSupply == IAmpleforth(ampl).totalSupply(),
            "AmpleforthChainBridgeGateway: recorded total supply not consistent"
        );

        emit XCRebaseReportOut(recordedAMPLEpoch, recordedTotalAMPLSupply);

        return true;
    }

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
            "AmpleforthChainBridgeGateway: recorded total supply not consistent"
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
        address policy_,
        address vault_
    ) public {
        ampl = ampl_;
        policy = policy_;
        vault = vault_;

        transferOwnership(bridgeHandler);
    }
}
