pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../bridge/IBridgeAmplforthGateway.sol";

/**
 * @title CBXCAmplRebaseGateway
 * @dev This contract is deployed across the master chain on the 'other' evm chain.
 *      It's a pass-through contract between the ChainBridge Generic handler contract and
 *      the XC-AmpleforthPolicy.
 *
 *      It forwards the rebase report from the ChainBrdige handler contract to the
 *      XCAmpleforthPolicy.
 *
 *      NOTE: This contract is NOT upgradeable.
 */
contract CBXCAmplRebaseGateway is IBridgeAmplforthRebaseGateway, Ownable {
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
