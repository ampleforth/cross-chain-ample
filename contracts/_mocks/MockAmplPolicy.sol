pragma solidity 0.6.4;

contract MockAmplPolicy {
    uint256 public epoch;

    function updateEpoch(uint256 epoch_) external {
        epoch = epoch_;
    }
}
