pragma solidity 0.6.4;

interface IAmpleforthPolicy {
    function epoch() external returns (uint256);
}

interface IAmpleforth {
    function totalSupply() external returns (uint256);
}

interface IXCAmpleforth {
    function totalAMPLSupply() external returns (uint256);
}

interface IXCAmpleforthPolicy {
    function currentAMPLEpoch() external returns (uint256);

    function mint(address recipient, uint256 xcAmplAmount) external;

    function burn(address depositor, uint256 xcAmplAmount) external;

    function reportRebase(uint256 nextAMPLEpoch, uint256 nextTotalAMPLSupply) external;
}

interface ITokenVault {
    function lock(address depositor, uint256 amount) external;

    function unlock(address recipient, uint256 amount) external;
}

/**
 * @title IBridgeAmplforthGateway
 * @dev Gateway contracts are deployed on both chains.
 *      They are simple intermediate contracts which implement bridge specific encoding/decoding
 *      and data validation.
 *
 *      On the 'master' chain they interface between chain bridge handler and the AmplVault
 *      On the 'other' chain they interface between chain bridge handler and the XCAmpleforthPolicy
 */
interface IBridgeAmplforthRebaseGateway {
    event XCRebaseReportIn(
        uint256 recordedAMPLEpoch,
        uint256 recordedTotalAMPLSupply,
        uint256 currentAMPLEpoch,
        uint256 currentTotalAMPLSupply
    );

    event XCRebaseReportOut(uint256 currentAMPLEpoch, uint256 currentTotalAMPLSupply);
}

interface IBridgeAmplforthTransferGateway {
    event XCTransferIn(
        address depositor,
        address recipient,
        uint256 recordedAmount,
        uint256 recordedTotalAMPLSupply,
        uint256 inferredAmount,
        uint256 currentTotalAMPLSupply
    );

    event XCTransferOut(
        address depositor,
        address recipient,
        uint256 recordedAmount,
        uint256 recordedTotalAMPLSupply
    );
}
