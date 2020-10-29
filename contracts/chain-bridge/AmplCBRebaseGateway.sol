pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../bridge/IBridgeAmplforthGateway.sol";

/**
 * @title AmplCBRebaseGateway: Ampl-ChainBridge Rebase Gateway
 * @dev This contract is deployed on the 'master' chain (Ethereum).
 *
 *      It validates rebase data from the ChainBridge handler contract,
 *      before it's transmitted across the Bridge.
 *
 */
contract AmplCBRebaseGateway is IBridgeAmplforthRebaseGateway, Ownable {
    using SafeMath for uint256;

    address public ampl;
    address public policy;

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
            "AmplCBRebaseGateway: recorded epoch not consistent"
        );
        require(
            recordedTotalAMPLSupply == IAmpleforth(ampl).totalSupply(),
            "AmplCBRebaseGateway: recorded total supply not consistent"
        );

        emit XCRebaseReportOut(recordedAMPLEpoch, recordedTotalAMPLSupply);

        return true;
    }

    constructor(
        address bridgeHandler,
        address ampl_,
        address policy_
    ) public {
        ampl = ampl_;
        policy = policy_;

        transferOwnership(bridgeHandler);
    }
}
