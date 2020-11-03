pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../bridge/IBridgeAmplforthGateway.sol";

/**
 * @title CBXCAmplTransferGateway
 * @dev This contract is deployed across the master chain on the 'other' evm chain.
 *      It's a pass-through contract between the ChainBridge Handler contract and
 *      the XC-AmpleforthPolicy.
 *
 *      When the user transfers AMPLs from the master chain to this chain,
 *      xc-ampl tokens are mint through this gateway contract.
 *      The amount of tokens to be mint is calculated based on the total supply recorded
 *      at the time of transfer and the current total supply.
 *
 *      When the user transfers AMPLs from this chain back to the master chain,
 *      the xc-ampl tokens are burnt.
 *
 *      NOTE: This contract is NOT upgradeable.
 */
contract CBXCAmplTransferGateway is IBridgeAmplforthTransferGateway, Ownable {
    using SafeMath for uint256;

    address public xcAmpl;
    address public xcAmplPolicy;

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
            "CBXCAmplTransferGateway: recorded total supply not consistent"
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
