pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../bridge/IBridgeAmplforthGateway.sol";

/**
 * @title ChainBridgeXCAmpleforthPolicyGateway
 * @dev This contract is deployed across the master chain on the 'other' evm chain.
 *      It's a intermediate contract between the ChainBridge Generic handler contract and
 *      the XC-AmpleforthPolicy.
 *
 *      It validates data from the handler contract.
 *      In case of mints, it also handles gons to AMPL conversion.
 *
 *      NOTE: This contract is NOT upgradeable.
 */
contract ChainBridgeXCAmpleforthPolicyGateway is IBridgeAmplforthGateway, Ownable {
    using SafeMath for uint256;

    address public xcAmpl;
    address public xcAmplPolicy;

    /**
     * @notice Forwards the most recent rebase information from the bridge handler
     *         to XC-Ampleforth policy.
     */
    function reportRebase(uint256 recordedAMPLEpoch, uint256 recordedTotalAMPLSupply)
        external
        onlyOwner
        returns (bool)
    {
        uint256 currentAMPLEpoch = IXCAmpleforthPolicy(xcAmplPolicy).currentAMPLEpoch();
        uint256 currentTotalAMPLSupply = IXCAmpleforth(xcAmpl).totalAMPLSupply();
        emit XCRebaseReportIn(
            recordedAMPLEpoch,
            recordedTotalAMPLSupply,
            currentAMPLEpoch,
            currentTotalAMPLSupply
        );

        IXCAmpleforthPolicy(xcAmplPolicy).reportRebase(recordedAMPLEpoch, recordedTotalAMPLSupply);

        return true;
    }

    /**
     * @notice Infers the correct amount of xc-amples to be mint based on the
     *         gon amount in the packed data and mints xc-amples to the recipient.
     */
    function mint(
        address depositor,
        address recipient,
        uint256 recordedAmount,
        uint256 recordedTotalAMPLSupply
    ) external onlyOwner returns (bool) {
        uint256 currentTotalAMPLSupply = IXCAmpleforth(xcAmpl).totalAMPLSupply();
        uint256 inferredAmount = recordedAmount.mul(currentTotalAMPLSupply).div(
            recordedTotalAMPLSupply
        );
        IXCAmpleforthPolicy(xcAmplPolicy).mint(recipient, inferredAmount);

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

    /**
     * @notice Validates the packed data and burns specified amount from the depositor's wallet.
     */
    function validateAndBurn(
        address depositor,
        address recipient,
        uint256 recordedAmount,
        uint256 recordedTotalAMPLSupply
    ) external onlyOwner returns (bool) {
        require(
            recordedTotalAMPLSupply == IXCAmpleforth(xcAmpl).totalAMPLSupply(),
            "ChainBridgeXCAmpleforthPolicyGateway: recorded total supply not consistent"
        );
        IXCAmpleforthPolicy(xcAmplPolicy).burn(depositor, recordedAmount);

        emit XCTransferOut(depositor, recipient, recordedAmount, recordedTotalAMPLSupply);

        return true;
    }

    constructor(
        address bridgeHandler,
        address xcAmpl_,
        address xcAmplPolicy_
    ) public {
        xcAmpl = xcAmpl_;
        xcAmplPolicy = xcAmplPolicy_;

        transferOwnership(bridgeHandler);
    }
}
