pragma solidity 0.6.4;

contract MockXCAmplPolicy {
    event MockRebaseReport(uint256 epoch, uint256 totalSupply);
    event MockMint(address who, uint256 value);
    event MockBurn(address who, uint256 value);

    uint256 public currentAMPLEpoch;

    function mint(address recipient, uint256 xcAmplAmount) external {
        emit MockMint(recipient, xcAmplAmount);
    }

    function burn(address depositor, uint256 xcAmplAmount) external {
        emit MockBurn(depositor, xcAmplAmount);
    }

    function reportRebase(uint256 nextAMPLEpoch, uint256 nextTotalAMPLSupply) external {
        emit MockRebaseReport(nextAMPLEpoch, nextTotalAMPLSupply);
    }

    function updateAMPLEpoch(uint256 currentAMPLEpoch_) external {
        currentAMPLEpoch = currentAMPLEpoch_;
    }
}
