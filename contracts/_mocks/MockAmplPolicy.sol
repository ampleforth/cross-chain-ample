pragma solidity 0.6.12;

contract MockAmplPolicy {
    uint256 public epoch;

    function updateEpoch(uint256 epoch_) external {
        epoch = epoch_;
    }
}